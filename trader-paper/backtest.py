#!/usr/bin/env python3
"""Backtest for trader-paper: replay paper.py's exact entry and exit rules on past sessions. Standard library only.

    python3 backtest.py --days 180                       # every signal on the universe, last 180 calendar days
    python3 backtest.py --days 180 --symbols TSLA,NVDA    # or a list of your own
    python3 backtest.py --days 180 --orb-target 1.5 --atr-k 2   # try a variant, same data

Rules, the same as `paper.py run`:
  orb        first 5-minute close above the 15-minute opening range, 9:50 to 11:30 AM ET;
             entry at that close, stop at the range midpoint, target TARGET_R x risk
  daily      setups on complete daily closes before the day (find_setups); entry at the
             close of the 9:55 bar (10:00 AM) if it is above the first bar's close;
             stop ATR_K x ATR of the session's bars so far, target TARGET_R x risk
  exits      walk the later bars: stop first if a bar touches both, else target; flat at 3:55 PM

5-minute SIP bars from Alpaca, cached under ~/.cache/trader-paper. Every signal is
taken (no position limits), so each strategy gets as many samples as the data has.
The first 70 % of the days are the in-sample period, the last 30 % the out-of-sample check.
Caveat: the universe is today's most-active list (survivorship bias). Costs are a per-side
slippage in percent (--slip).
"""

import argparse
import datetime
import gzip
import hashlib
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("trader_paper", os.path.join(HERE, "paper.py"))
paper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(paper)
scan, exitp = paper.scan, paper.exitp

CACHE = os.path.expanduser("~/.cache/trader-paper")


def cached_bars(symbols, timeframe, start, end, feed):
    os.makedirs(CACHE, exist_ok=True)
    key = "%s-%s-%s-%s-%d.json.gz" % (timeframe, start.date(), end.date(), feed, int(hashlib.sha1(",".join(symbols).encode()).hexdigest()[:8], 16))
    path = os.path.join(CACHE, key)
    if os.path.exists(path):
        with gzip.open(path, "rt") as f:
            return json.load(f)
    data = paper.bars(symbols, timeframe, start, feed, end_utc=end)
    with gzip.open(path, "wt") as f:
        json.dump(data, f)
    return data


def walk(bars, k, entry, stop, target, flat_at):
    """Exit after bar k. Returns (exit price, reason, bars held)."""
    last = None
    for j in range(k + 1, len(bars)):
        b = bars[j]
        if b["start"].time() >= flat_at:
            break
        last = j
        if b["l"] is not None and b["l"] <= stop:
            return stop, "stop", j - k
        if b["h"] is not None and b["h"] >= target:
            return target, "target", j - k
    j = last if last is not None else k
    return bars[j]["c"], "close", j - k


def daily_index(series):
    """{date: index} of daily bars, and closes."""
    idx = {}
    for i, ts in enumerate(series["t"]):
        idx[scan.ts_to_eastern(ts).date()] = i
    return idx


def run(a):
    syms = a.symbols.split(",") if a.symbols else paper.universe()
    end = paper.now_utc() - datetime.timedelta(minutes=16)
    start = end - datetime.timedelta(days=a.days)
    print("fetching %d symbols, %d days of 5-minute and daily bars ..." % (len(syms), a.days), file=sys.stderr)
    m5 = cached_bars(syms, "5Min", start, end, "sip")
    d1 = cached_bars(syms, "1Day", start - datetime.timedelta(days=200), end, "sip")
    today = paper.et_now().date()
    days = sorted({scan.ts_to_eastern(t).date() for s in m5.values() for t in s["t"]} - {today})
    days = [d for d in days if scan.session(d)]
    split = days[int(len(days) * 0.7)] if days else None
    trades = []
    for sym in syms:
        ser, dser = m5.get(sym), d1.get(sym)
        if not ser:
            continue
        didx = daily_index(dser) if dser else {}
        dcloses = [float(c) for c in dser["c"]] if dser else []
        for d in days:
            s = scan.session(d)
            close_dt = datetime.datetime.combine(d, s[1])
            flat_at = min(paper.FLAT_AT, (close_dt - datetime.timedelta(minutes=5)).time())
            bars = scan.session_bars(ser, d, close_dt)
            if len(bars) < 8 or any(b["h"] is None for b in bars[:paper.OR_BARS]):
                continue
            if [b["start"] for b in bars[:paper.OR_BARS]] != [scan.slot(d, j) for j in range(paper.OR_BARS)]:
                continue  # the opening range has a gap
            # orb
            early = [b for b in bars if b["start"] + datetime.timedelta(minutes=5) <=
                     datetime.datetime.combine(d, paper.ORB_UNTIL)]
            h = scan.orb_hit(early, paper.OR_BARS)
            if h and h["_t"].time() >= datetime.time(9, 50):
                mid = (h["or_high"] + h["or_low"]) / 2
                e = bars[h["bar_index"]]["c"]
                risk = e - mid
                if risk > 0:
                    x, why, held = walk(bars, h["bar_index"], e, mid, e + a.orb_target * risk, flat_at)
                    trades.append(trade(sym, d, "orb", e, mid, x, why, held, a.slip))
            # daily setups
            i = didx.get(d)
            if i is None or i < scan.MIN_DAILY_BARS:
                continue
            tags, _ = scan.find_setups(dcloses[:i])
            tags = [t for t in tags if t in paper.DAILY_STRATEGIES]
            k = next((j for j, b in enumerate(bars) if b["start"].time() == datetime.time(9, 55)), None)
            if not tags or k is None:
                continue
            e = bars[k]["c"]
            if e <= bars[0]["c"]:
                continue
            atr, _ = exitp.atr_of(bars[:k + 1])
            if atr <= 0:
                continue
            stop = e - a.atr_k * atr
            x, why, held = walk(bars, k, e, stop, e + a.daily_target * a.atr_k * atr, flat_at)
            trades.append(trade(sym, d, tags[0], e, stop, x, why, held, a.slip))
    return trades, days, split


def trade(sym, d, strategy, entry, stop, exit_, why, held, slip):
    risk = entry - stop
    gross = exit_ / entry - 1
    net = gross - 2 * slip / 100.0
    return {"symbol": sym, "date": d.isoformat(), "strategy": strategy, "entry": round(entry, 4),
            "stop": round(stop, 4), "exit": round(exit_, 4), "exit_reason": why, "bars": held,
            "pct": round(net * 100, 4), "r": round((exit_ - entry) / risk - 2 * slip / 100.0 * entry / risk, 3)}


def summarize(rows):
    n = len(rows)
    if not n:
        return None
    wins = [r for r in rows if r["r"] > 0]
    gw = sum(r["r"] for r in wins)
    gl = -sum(r["r"] for r in rows if r["r"] <= 0)
    return {"n": n, "hit": 100.0 * len(wins) / n, "avg_r": sum(r["r"] for r in rows) / n,
            "avg_pct": sum(r["pct"] for r in rows) / n, "pf": gw / gl if gl else float("inf"),
            "target": sum(1 for r in rows if r["exit_reason"] == "target"),
            "stop": sum(1 for r in rows if r["exit_reason"] == "stop")}


def table(trades, split):
    out = ["| Strategie | Zeitraum | Trades | Treffer | Ø R | Ø % | Profit-Faktor | Ziel / Stop / Schluss |",
           "|---|---|---|---|---|---|---|---|"]
    for st in sorted(set(t["strategy"] for t in trades)):
        rows = [t for t in trades if t["strategy"] == st]
        for label, part in (("alle", rows), ("in-sample", [t for t in rows if t["date"] < split]),
                            ("out-of-sample", [t for t in rows if t["date"] >= split])):
            s = summarize(part)
            if s:
                out.append("| %s | %s | %d | %.0f %% | %+.3f | %+.3f %% | %.2f | %d / %d / %d |" % (
                    st, label, s["n"], s["hit"], s["avg_r"], s["avg_pct"], s["pf"], s["target"], s["stop"],
                    s["n"] - s["target"] - s["stop"]))
    return "\n".join(out)


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--days", type=int, default=180)
    p.add_argument("--symbols")
    p.add_argument("--orb-target", type=float, default=paper.TARGET_R)
    p.add_argument("--daily-target", type=float, default=paper.TARGET_R)
    p.add_argument("--atr-k", type=float, default=paper.ATR_K)
    p.add_argument("--slip", type=float, default=0.02, help="slippage per side in percent")
    p.add_argument("--out", help="write the trades and the table here (a folder)")
    a = p.parse_args(argv)
    trades, days, split = run(a)
    head = "Backtest %s bis %s (%d Handelstage), Split %s, orb-Ziel %sR, Tages-Ziel %sR, ATR-k %s, Slippage %s %% je Seite" % (
        days[0] if days else "-", days[-1] if days else "-", len(days), split, a.orb_target, a.daily_target,
        a.atr_k, a.slip)
    tab = table(trades, split.isoformat() if split else "")
    print(head + "\n\n" + tab)
    if a.out:
        os.makedirs(a.out, exist_ok=True)
        with open(os.path.join(a.out, "trades.json"), "w") as f:
            json.dump(trades, f)
        with open(os.path.join(a.out, "summary.md"), "w") as f:
            f.write("# " + head + "\n\n" + tab + "\n")


if __name__ == "__main__":
    main()
