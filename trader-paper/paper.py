#!/usr/bin/env python3
"""Paper Trader for trader-paper: run the pack's setups on Alpaca's PAPER account. Standard library only.

    python3 paper.py universe                 # most-active US stocks -> journal/state/universe.json
    python3 paper.py daily                    # daily setups on complete daily bars -> journal/state/watchlist.json
    python3 paper.py run --until 15:56        # trade the day: orb + daily entries, stops, targets, flat by 3:55 PM
    python3 paper.py flatten                  # cancel every open order, close every position, log the exits
    python3 paper.py report                   # journal/tally.md from journal/trades.csv

Market data comes from Alpaca (data.alpaca.markets): SIP for complete daily bars,
IEX for today's 5-minute bars and the latest trade. The setups are the scanner's
own functions (find_setups, session_bars, orb_hit) and the exit planner's ATR.

Hard rules, enforced by check_order before every request that could trade:
  * only https://paper-api.alpaca.markets, never the live host
  * buys: market, day, a notional between MIN_NOTIONAL and MAX_NOTIONAL dollars,
    a tradable, fractionable us_equity; never qty, never options, never crypto
  * sells: only shares the account already holds (no short selling)
  * limits: open positions, trades a day, the day's realized loss

The account itself has margin (max_margin_multiplier 1) and shorting (no_shorting)
turned off. Credentials are added by the session's proxy, never stored here.
"""

import argparse
import csv
import datetime
import importlib.util
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

PAPER = "https://paper-api.alpaca.markets"
DATA = "https://data.alpaca.markets"
LIVE = "api.alpaca.markets"
assert PAPER.startswith("https://paper-") and DATA.startswith("https://data.")

MIN_NOTIONAL = 2.0
MAX_NOTIONAL = 5.0
NOTIONAL = 4.0
MAX_OPEN = 10
MAX_TRADES_DAY = 12
MAX_PER_STRATEGY = 4
MAX_DAY_LOSS = 2.50
OR_BARS = 3                      # 15-minute opening range on 5-minute bars
ORB_UNTIL = datetime.time(11, 30)
DAILY_AT = datetime.time(10, 0)
FLAT_AT = datetime.time(15, 55)
TARGET_R = 2.0                   # the exit planner's default target
ATR_K = 1.5                      # stop for daily setups: 1.5 x ATR(14) of the session's 5-minute bars
DAILY_STRATEGIES = ("breakout_20d", "bull_flag", "reclaim_ma20", "oversold_bounce")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JOURNAL = os.environ.get("TRADER_JOURNAL") or os.path.join(ROOT, "journal")
TRADE_FIELDS = ["id", "date", "symbol", "strategy", "notional", "qty", "entry", "stop", "target",
                "exit", "exit_reason", "pnl_usd", "pnl_pct", "r_multiple", "entry_time", "exit_time",
                "setup_detail"]


class GuardError(Exception):
    pass


def _load(folder, name):
    spec = importlib.util.spec_from_file_location("trader_" + name, os.path.join(ROOT, folder, name + ".py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


scan = _load("trader-scanner", "scan")
exitp = _load("trader-exit", "exit")


# ---------------------------------------------------------------- guard

def check_order(order, ctx):
    """Pure. order: what we are about to send. ctx: base url, asset, positions {SYM: qty},
    open trades, today's trades, today's realized P&L. Raises GuardError, returns None."""
    base = ctx.get("base", "")
    if base != PAPER or LIVE in base.replace("paper-api.", ""):
        raise GuardError("not the paper host: %r" % base)
    sym = order.get("symbol", "")
    side = order.get("side")
    if side == "buy":
        if order.get("qty") is not None:
            raise GuardError("buys go by notional, never qty")
        try:
            n = float(order.get("notional"))
        except (TypeError, ValueError):
            raise GuardError("a buy needs a notional")
        if not MIN_NOTIONAL <= n <= MAX_NOTIONAL:
            raise GuardError("notional %.2f is outside %.2f to %.2f" % (n, MIN_NOTIONAL, MAX_NOTIONAL))
        if order.get("type") != "market" or order.get("time_in_force") != "day":
            raise GuardError("buys are market orders, good for the day")
        a = ctx.get("asset") or {}
        if a.get("class") != "us_equity":
            raise GuardError("%s is %s, only us_equity" % (sym, a.get("class")))
        if not (a.get("tradable") and a.get("fractionable") and a.get("status") == "active"):
            raise GuardError("%s is not an active, tradable, fractionable stock" % sym)
        if sym in ctx.get("positions", {}) or any(t["symbol"] == sym for t in ctx.get("open", [])):
            raise GuardError("already holding %s" % sym)
        if len(ctx.get("open", [])) >= MAX_OPEN:
            raise GuardError("%d positions open, the limit" % MAX_OPEN)
        if ctx.get("trades_today", 0) >= MAX_TRADES_DAY:
            raise GuardError("%d trades today, the limit" % MAX_TRADES_DAY)
        if ctx.get("pnl_today", 0.0) <= -MAX_DAY_LOSS:
            raise GuardError("down %.2f today, the daily loss limit" % -ctx["pnl_today"])
        return None
    if side == "sell":
        if order.get("notional") is not None:
            raise GuardError("sells go by qty")
        held = float(ctx.get("positions", {}).get(sym, 0))
        try:
            q = float(order.get("qty"))
        except (TypeError, ValueError):
            raise GuardError("a sell needs a qty")
        if held <= 0 or q <= 0 or q > held + 1e-9:
            raise GuardError("selling %s %s but holding %s: no short selling" % (q, sym, held))
        return None
    raise GuardError("side must be buy or sell")


# ---------------------------------------------------------------- http

def request(method, url, body=None, tries=3):
    if not (url.startswith(PAPER + "/") or url.startswith(DATA + "/")):
        raise GuardError("refusing %s" % url)
    data = json.dumps(body).encode() if body is not None else None
    for k in range(tries):
        req = urllib.request.Request(url, data=data, method=method,
                                     headers={"Content-Type": "application/json", "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                txt = r.read().decode()
                return json.loads(txt) if txt else None
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")
            if e.code in (429, 500, 502, 503, 504) and k + 1 < tries:
                time.sleep(2 * (k + 1))
                continue
            raise RuntimeError("%s %s -> HTTP %d %s" % (method, url, e.code, msg[:300]))
        except urllib.error.URLError:
            if k + 1 < tries:
                time.sleep(2 * (k + 1))
                continue
            raise


def api(method, path, body=None):
    return request(method, PAPER + path, body)


def data(path, params):
    return request("GET", DATA + path + "?" + urllib.parse.urlencode(params))


# ---------------------------------------------------------------- time

def now_utc():
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None, microsecond=0)


def et_now():
    return scan.to_eastern(now_utc())


def iso_utc(naive_utc):
    return naive_utc.strftime("%Y-%m-%dT%H:%M:%SZ")


def epoch(ts):
    d = datetime.datetime.strptime(ts[:19], "%Y-%m-%dT%H:%M:%S")
    return int((d - datetime.datetime(1970, 1, 1)).total_seconds())


# ---------------------------------------------------------------- data

def bars(symbols, timeframe, start_utc, feed, end_utc=None):
    """Alpaca bars -> {SYM: series} in the scanner's shape (t in unix seconds)."""
    out = {}
    for i in range(0, len(symbols), 100):
        chunk = symbols[i:i + 100]
        token = None
        while True:
            p = {"symbols": ",".join(chunk), "timeframe": timeframe, "start": iso_utc(start_utc),
                 "feed": feed, "limit": 10000, "adjustment": "split"}
            if end_utc:
                p["end"] = iso_utc(end_utc)
            if token:
                p["page_token"] = token
            doc = data("/v2/stocks/bars", p)
            for sym, rows in (doc.get("bars") or {}).items():
                s = out.setdefault(sym, {"t": [], "o": [], "h": [], "l": [], "c": [], "v": []})
                for b in rows:
                    s["t"].append(epoch(b["t"]))
                    for k in "ohlcv":
                        s[k].append(b[k])
            token = doc.get("next_page_token")
            if not token:
                break
    return out


def latest_prices(symbols):
    if not symbols:
        return {}
    doc = data("/v2/stocks/trades/latest", {"symbols": ",".join(symbols), "feed": "iex"})
    return {s: float(t["p"]) for s, t in (doc.get("trades") or {}).items()}


def session_5m(symbols, day):
    open_utc = scan.eastern_to_utc(datetime.datetime.combine(day, scan.OPEN))
    raw = bars(symbols, "5Min", open_utc, "iex")
    cutoff = et_now()
    return {s: scan.session_bars(ser, day, cutoff) for s, ser in raw.items()}


# ---------------------------------------------------------------- journal

def jpath(*parts):
    return os.path.join(JOURNAL, *parts)


def read_json(path, default):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def write_json(path, doc):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(doc, f, indent=2, sort_keys=True)
        f.write("\n")
    os.replace(tmp, path)


def read_trades():
    try:
        with open(jpath("trades.csv"), newline="") as f:
            return list(csv.DictReader(f))
    except OSError:
        return []


def append_trade(row):
    path = jpath("trades.csv")
    new = not os.path.exists(path)
    os.makedirs(JOURNAL, exist_ok=True)
    with open(path, "a", newline="") as f:
        w = csv.DictWriter(f, fieldnames=TRADE_FIELDS)
        if new:
            w.writeheader()
        w.writerow({k: row.get(k, "") for k in TRADE_FIELDS})


def log(msg):
    line = "%s ET  %s" % (et_now().strftime("%Y-%m-%d %H:%M:%S"), msg)
    print(line, flush=True)
    os.makedirs(jpath("state"), exist_ok=True)
    with open(jpath("state", "run-%s.log" % et_now().date().isoformat()), "a") as f:
        f.write(line + "\n")


def day_stats(day):
    rows = [r for r in read_trades() if r["date"] == day]
    return len(rows), sum(float(r["pnl_usd"] or 0) for r in rows)


# ---------------------------------------------------------------- universe and setups

ETF_WORDS = ("ETF", "ETN", "FUND", "PROSHARES", "DIREXION", "ISHARES", "SPDR", "INVESCO", "2X", "3X",
             "ULTRA", "LEVERAGED", "INVERSE", "BULL", "BEAR", "TRUST")


def cmd_universe(a):
    syms = []
    for by in ("volume", "trades"):
        doc = data("/v1beta1/screener/stocks/most-actives", {"by": by, "top": a.top})
        syms += [x["symbol"] for x in doc.get("most_actives", [])]
    keep, seen = [], set()
    for s in syms:
        if s in seen:
            continue
        seen.add(s)
        try:
            asset = api("GET", "/v2/assets/" + urllib.parse.quote(s))
        except RuntimeError:
            continue
        name = (asset.get("name") or "").upper()
        if asset.get("class") != "us_equity" or not asset.get("fractionable") or not asset.get("tradable"):
            continue
        if any(w in name.split() or w in name for w in ETF_WORDS):
            continue
        keep.append(s)
    start = now_utc() - datetime.timedelta(days=10)
    daily = bars(keep, "1Day", start, "sip", end_utc=now_utc() - datetime.timedelta(minutes=16))
    out = []
    for s in keep:
        ser = daily.get(s)
        if not ser or not ser["c"]:
            continue
        px, vol = ser["c"][-1], ser["v"][-1]
        if px >= a.min_price and px * vol >= a.min_dollar_volume:
            out.append(s)
    write_json(jpath("state", "universe.json"), {"asof": et_now().isoformat(), "symbols": out})
    print("%d symbols in the universe (of %d most-active, ETFs and leveraged funds out, price >= %s, "
          "dollar volume >= %s)." % (len(out), len(seen), a.min_price, a.min_dollar_volume))


def universe():
    doc = read_json(jpath("state", "universe.json"), {})
    if not doc.get("symbols"):
        raise SystemExit("no universe yet: run `paper.py universe` first")
    return doc["symbols"]


def cmd_daily(a):
    syms = universe()
    today = et_now().date()
    start = now_utc() - datetime.timedelta(days=150)
    end = scan.eastern_to_utc(datetime.datetime.combine(today, datetime.time(0, 0)))
    daily = bars(syms, "1Day", start, "sip", end_utc=end)
    hits = []
    for s in syms:
        ser = daily.get(s)
        if not ser or len(ser["c"]) < scan.MIN_DAILY_BARS:
            continue
        tags, nums = scan.find_setups([float(c) for c in ser["c"]])
        tags = [t for t in tags if t in DAILY_STRATEGIES]
        if tags:
            hits.append({"symbol": s, "setups": tags, "close": ser["c"][-1],
                         "rsi": round(nums["rsi"] or 0, 1), "high20": round(nums["high20"], 2),
                         "ma20": round(nums["ma20"], 2)})
    write_json(jpath("state", "watchlist.json"), {"date": today.isoformat(), "hits": hits})
    for h in hits:
        print("%-6s %-40s close %.2f  rsi %.1f" % (h["symbol"], ", ".join(h["setups"]), h["close"], h["rsi"]))
    print("%d daily setups for %s." % (len(hits), today))


# ---------------------------------------------------------------- orders

def wait_fill(order_id, seconds=60):
    o = None
    for _ in range(seconds):
        o = api("GET", "/v2/orders/" + order_id)
        if o["status"] in ("filled", "canceled", "expired", "rejected"):
            return o
        time.sleep(1)
    return o


def positions():
    return {p["symbol"]: float(p["qty"]) for p in api("GET", "/v2/positions")}


def enter(sym, strategy, stop, target, detail, state, price):
    today = et_now().date().isoformat()
    open_ = state["open"]
    if sum(1 for t in open_ if t["strategy"] == strategy) + \
            sum(1 for r in read_trades() if r["date"] == today and r["strategy"] == strategy) >= MAX_PER_STRATEGY:
        return
    if stop >= price or target <= price:
        log("skip %s %s: stop %.2f / target %.2f do not bracket %.2f" % (sym, strategy, stop, target, price))
        return
    n_today, pnl_today = day_stats(today)
    order = {"symbol": sym, "notional": "%.2f" % NOTIONAL, "side": "buy", "type": "market",
             "time_in_force": "day", "client_order_id": "paper-%s-%s-%d" % (strategy[:8], sym, time.time())}
    ctx = {"base": PAPER, "asset": api("GET", "/v2/assets/" + urllib.parse.quote(sym)),
           "positions": positions(), "open": open_, "trades_today": n_today + len(open_), "pnl_today": pnl_today}
    try:
        check_order(order, ctx)
    except GuardError as e:
        log("guard blocked %s %s: %s" % (sym, strategy, e))
        return
    o = wait_fill(api("POST", "/v2/orders", order)["id"])
    if o["status"] != "filled":
        log("buy %s not filled (%s), cancelling" % (sym, o["status"]))
        try:
            api("DELETE", "/v2/orders/" + o["id"])
        except RuntimeError:
            pass
        return
    qty, fill = float(o["filled_qty"]), float(o["filled_avg_price"])
    risk = price - stop
    stop, target = round(fill - risk, 2), round(fill + TARGET_R * risk, 2)
    trade = {"id": o["id"], "date": today, "symbol": sym, "strategy": strategy, "notional": NOTIONAL,
             "qty": qty, "entry": fill, "stop": stop, "target": target,
             "entry_time": et_now().strftime("%H:%M:%S"), "setup_detail": detail, "stop_order": None}
    sell = {"symbol": sym, "qty": str(qty), "side": "sell", "type": "stop", "stop_price": "%.2f" % stop,
            "time_in_force": "day"}
    try:
        check_order(sell, {"base": PAPER, "positions": positions()})
        trade["stop_order"] = api("POST", "/v2/orders", sell)["id"]
    except (GuardError, RuntimeError) as e:
        log("no server-side stop for %s (%s): the loop watches the stop instead" % (sym, e))
    open_.append(trade)
    write_json(jpath("state", "open.json"), state)
    log("BUY  %s %s  %.6f sh @ %.2f  stop %.2f  target %.2f  (%s)" % (strategy, sym, qty, fill, stop, target, detail))


def close_trade(trade, reason, state, fill=None):
    sym = trade["symbol"]
    if fill is None:
        if trade.get("stop_order"):
            try:
                api("DELETE", "/v2/orders/" + trade["stop_order"])
                time.sleep(1)
            except RuntimeError:
                pass
        held = positions().get(sym, 0.0)
        if held > 0:
            sell = {"symbol": sym, "qty": str(held), "side": "sell", "type": "market", "time_in_force": "day"}
            check_order(sell, {"base": PAPER, "positions": {sym: held}})
            o = wait_fill(api("POST", "/v2/orders", sell)["id"])
            fill = float(o["filled_avg_price"]) if o.get("filled_avg_price") else None
        if fill is None:
            log("could not close %s: check it by hand" % sym)
            return
    pnl = (fill - trade["entry"]) * trade["qty"]
    risk = trade["entry"] - trade["stop"]
    row = dict(trade, exit=round(fill, 4), exit_reason=reason, pnl_usd=round(pnl, 4),
               pnl_pct=round((fill / trade["entry"] - 1) * 100, 3),
               r_multiple=round((fill - trade["entry"]) / risk, 2) if risk > 0 else "",
               exit_time=et_now().strftime("%H:%M:%S"))
    append_trade(row)
    state["open"] = [t for t in state["open"] if t["id"] != trade["id"]]
    write_json(jpath("state", "open.json"), state)
    log("SELL %s %s @ %.2f  %s  %+.4f USD (%+.2f %%)" % (trade["strategy"], sym, fill, reason, pnl, row["pnl_pct"]))


def manage(state):
    if not state["open"]:
        return
    px = latest_prices([t["symbol"] for t in state["open"]])
    for t in list(state["open"]):
        if t.get("stop_order"):
            o = api("GET", "/v2/orders/" + t["stop_order"])
            if o["status"] == "filled":
                close_trade(t, "stop", state, fill=float(o["filled_avg_price"]))
                continue
        p = px.get(t["symbol"])
        if p is None:
            continue
        if p >= t["target"]:
            close_trade(t, "target", state)
        elif p <= t["stop"] and not t.get("stop_order"):
            close_trade(t, "stop", state)


def orb_entries(state, done):
    day = et_now().date()
    syms = [s for s in universe() if s not in done]
    if not syms:
        return
    sb = session_5m(syms, day)
    hits = []
    for s, bs in sb.items():
        if len(bs) <= OR_BARS:
            continue
        h = scan.orb_hit(bs, OR_BARS)
        if h:
            hits.append((s, h))
    if not hits:
        return
    px = latest_prices([s for s, _ in hits])
    for s, h in sorted(hits, key=lambda x: x[1]["bar_index"], reverse=True):
        done.add(s)
        p = px.get(s)
        mid = round((h["or_high"] + h["or_low"]) / 2, 2)
        risk = h["price"] - mid
        if p is None or risk <= 0:
            continue
        if p <= h["or_high"] or p > h["price"] + 0.5 * risk:
            log("orb %s: triggered %s at %.2f but now %.2f, missed" % (s, h["at"], h["price"], p))
            continue
        enter(s, "orb", p - (h["price"] - mid), p + TARGET_R * (h["price"] - mid),
              "OR %.2f-%.2f, closed %.2f at %s (+%.2f%% over)" % (h["or_low"], h["or_high"], h["price"], h["at"],
                                                                h["pct_over"]), state, p)


def daily_entries(state):
    wl = read_json(jpath("state", "watchlist.json"), {})
    day = et_now().date()
    if wl.get("date") != day.isoformat():
        log("watchlist is from %s, not today: no daily entries" % wl.get("date"))
        return
    hits = wl.get("hits", [])
    sb = session_5m([h["symbol"] for h in hits], day)
    px = latest_prices([h["symbol"] for h in hits])
    for h in hits:
        s, bs, p = h["symbol"], sb.get(h["symbol"]) or [], px.get(h["symbol"])
        if p is None or len(bs) < 3:
            continue
        if p <= bs[0]["c"] and p <= bs[0]["h"]:
            log("daily %s (%s): %.2f not above the first bar, no entry" % (s, h["setups"][0], p))
            continue
        atr, n = exitp.atr_of(bs)
        strategy = h["setups"][0]
        enter(s, strategy, p - ATR_K * atr, p + TARGET_R * ATR_K * atr,
              "%s; close %.2f, rsi %.1f; stop %.1f x ATR(%d)=%.3f" % (", ".join(h["setups"]), h["close"], h["rsi"],
                                                                   ATR_K, n, atr), state, p)


def cmd_run(a):
    until = datetime.time(*map(int, a.until.split(":")))
    state = read_json(jpath("state", "open.json"), {"open": []})
    today = et_now().date()
    cal = api("GET", "/v2/calendar?start=%s&end=%s" % (today, today))
    if not cal or cal[0]["date"] != today.isoformat():
        log("market closed today")
        return
    flat_at = min(FLAT_AT, (datetime.datetime.strptime(cal[0]["close"], "%H:%M") - datetime.timedelta(minutes=5)).time())
    done = set(t["symbol"] for t in state["open"]) | set(r["symbol"] for r in read_trades() if r["date"] == str(today))
    daily_done = os.path.exists(jpath("state", "daily-done-%s" % today))
    last_orb = None
    log("run until %s, flat at %s, %d open" % (until, flat_at, len(state["open"])))
    while True:
        t = et_now().time()
        if t >= flat_at:
            for tr in list(state["open"]):
                close_trade(tr, "close", state)
            log("flat for the day")
            return
        if t >= until:
            log("stopping at %s with %d open" % (until, len(state["open"])))
            return
        try:
            manage(state)
            if datetime.time(9, 50) <= t < ORB_UNTIL and (last_orb is None or time.time() - last_orb >= 300):
                last_orb = time.time()
                orb_entries(state, done)
            if t >= DAILY_AT and not daily_done:
                daily_entries(state)
                daily_done = True
                open(jpath("state", "daily-done-%s" % today), "w").close()
        except (RuntimeError, urllib.error.URLError) as e:
            log("error: %s" % e)
        time.sleep(a.every)


def cmd_flatten(a):
    state = read_json(jpath("state", "open.json"), {"open": []})
    for tr in list(state["open"]):
        close_trade(tr, "manual", state)
    print("%d open trades left." % len(state["open"]))


# ---------------------------------------------------------------- report

def stats(rows):
    n = len(rows)
    w = sum(1 for r in rows if float(r["pnl_usd"]) > 0)
    pnl = sum(float(r["pnl_usd"]) for r in rows)
    pct = [float(r["pnl_pct"]) for r in rows]
    rs = [float(r["r_multiple"]) for r in rows if r["r_multiple"] not in ("", None)]
    return {"n": n, "wins": w, "losses": n - w, "hit": 100.0 * w / n if n else 0.0, "pnl": pnl,
            "avg_pct": sum(pct) / n if n else 0.0, "avg_r": sum(rs) / len(rs) if rs else 0.0}


def cmd_report(a):
    rows = read_trades()
    lines = ["# Strichliste", "", "Erzeugt von `trader-paper/paper.py report` am %s ET. Quelle: `trades.csv`." %
             et_now().strftime("%Y-%m-%d %H:%M"), ""]
    s = stats(rows)
    lines += ["## Gesamt", "", "| Trades | Gewinne | Verluste | Trefferquote | P&L USD | Ø % pro Trade | Ø R |",
              "|---|---|---|---|---|---|---|",
              "| %d | %s | %s | %.0f %% | %+.4f | %+.3f %% | %+.2f |" % (s["n"], "I" * s["wins"] or "0",
                                                                     "I" * s["losses"] or "0", s["hit"], s["pnl"],
                                                                     s["avg_pct"], s["avg_r"]), ""]
    for title, key in (("Nach Strategie", "strategy"), ("Nach Tag", "date")):
        lines += ["## " + title, "", "| %s | Trades | Gewinne | Verluste | Trefferquote | P&L USD | Ø %% | Ø R |" %
                  key, "|---|---|---|---|---|---|---|---|"]
        for k in sorted(set(r[key] for r in rows)):
            g = stats([r for r in rows if r[key] == k])
            lines.append("| %s | %d | %d | %d | %.0f %% | %+.4f | %+.3f %% | %+.2f |" % (
                k, g["n"], g["wins"], g["losses"], g["hit"], g["pnl"], g["avg_pct"], g["avg_r"]))
        lines.append("")
    with open(jpath("tally.md"), "w") as f:
        f.write("\n".join(lines))
    print("\n".join(lines))


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = p.add_subparsers(dest="cmd", required=True)
    u = sub.add_parser("universe")
    u.add_argument("--top", type=int, default=100)
    u.add_argument("--min-price", type=float, default=5.0)
    u.add_argument("--min-dollar-volume", type=float, default=50e6)
    sub.add_parser("daily")
    r = sub.add_parser("run")
    r.add_argument("--until", default="15:56")
    r.add_argument("--every", type=int, default=60)
    sub.add_parser("flatten")
    sub.add_parser("report")
    a = p.parse_args(argv)
    {"universe": cmd_universe, "daily": cmd_daily, "run": cmd_run, "flatten": cmd_flatten,
     "report": cmd_report}[a.cmd](a)


if __name__ == "__main__":
    main()
