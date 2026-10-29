import unittest

from _load import load

paper = load("trader-paper", "paper")
G = paper.GuardError
ASSET = {"class": "us_equity", "tradable": True, "fractionable": True, "status": "active"}


def buy(**kw):
    o = {"symbol": "AAPL", "notional": "4.00", "side": "buy", "type": "market", "time_in_force": "day"}
    o.update(kw)
    return o


def bracket(**kw):
    o = {"symbol": "AAPL", "qty": "4", "side": "buy", "type": "market", "time_in_force": "day",
         "order_class": "bracket", "stop_loss": {"stop_price": "395.00"}, "take_profit": {"limit_price": "410.00"}}
    o.update(kw)
    if o.get("qty") is None:
        o.pop("qty")
    return o


def ctx(**kw):
    c = {"base": paper.PAPER, "asset": dict(ASSET), "positions": {}, "open": [], "trades_today": 0,
         "pnl_today": 0.0}
    c.update(kw)
    return c


class Guard(unittest.TestCase):
    def test_plain_buy_passes(self):
        self.assertIsNone(paper.check_order(buy(), ctx()))

    def test_live_host_blocked(self):
        for base in ("https://api.alpaca.markets", "https://paper-api.alpaca.markets.evil", ""):
            with self.assertRaises(G):
                paper.check_order(buy(), ctx(base=base))

    def test_notional_bounds(self):
        for n in ("1.99", "2500.01", "100000", None, "x"):
            with self.assertRaises(G):
                paper.check_order(buy(notional=n), ctx())
        for n in ("2", "5", "2000", "2500"):
            paper.check_order(buy(notional=n), ctx())

    def test_qty_buy_blocked(self):
        with self.assertRaises(G):
            paper.check_order(buy(qty="1"), ctx())

    def test_options_crypto_and_odd_assets_blocked(self):
        for a in ({"class": "us_option"}, {"class": "crypto"}, dict(ASSET, fractionable=False),
                  dict(ASSET, tradable=False), dict(ASSET, status="inactive")):
            with self.assertRaises(G):
                paper.check_order(buy(), ctx(asset=a))

    def test_limits(self):
        with self.assertRaises(G):
            paper.check_order(buy(), ctx(open=[{"symbol": "X%d" % i} for i in range(paper.MAX_OPEN)]))
        with self.assertRaises(G):
            paper.check_order(buy(), ctx(trades_today=paper.MAX_TRADES_DAY))
        with self.assertRaises(G):
            paper.check_order(buy(), ctx(pnl_today=-paper.MAX_DAY_LOSS))
        with self.assertRaises(G):
            paper.check_order(buy(), ctx(positions={"AAPL": 0.01}))

    def test_limit_and_stop_buys_blocked(self):
        for kw in ({"type": "limit"}, {"time_in_force": "gtc"}):
            with self.assertRaises(G):
                paper.check_order(buy(**kw), ctx())

    def test_no_short_selling(self):
        sell = {"symbol": "AAPL", "qty": "0.02", "side": "sell", "type": "market", "time_in_force": "day"}
        self.assertIsNone(paper.check_order(sell, ctx(positions={"AAPL": 0.02})))
        for pos in ({}, {"AAPL": 0.01}, {"MSFT": 1}):
            with self.assertRaises(G):
                paper.check_order(sell, ctx(positions=pos))
        with self.assertRaises(G):
            paper.check_order(dict(sell, qty=None, notional="4"), ctx(positions={"AAPL": 1}))

    def test_bracket_buy_passes(self):
        self.assertIsNone(paper.check_order(bracket(), ctx(price=400.0)))

    def test_bracket_needs_whole_shares_and_size(self):
        for q in ("1.5", "0", "-1", "", None):
            with self.assertRaises(G):
                paper.check_order(bracket(qty=q), ctx(price=400.0))
        with self.assertRaises(G):  # 7 x 400 = 2,800, over MAX_NOTIONAL
            paper.check_order(bracket(qty="7"), ctx(price=400.0))
        with self.assertRaises(G):
            paper.check_order(bracket(notional="2000"), ctx(price=400.0))
        with self.assertRaises(G):
            paper.check_order(bracket(), ctx())  # no current price

    def test_bracket_legs_must_straddle_the_price(self):
        for sl, tp in (("400.00", "410.00"), ("395.00", "400.00"), ("401.00", "410.00"), ("395.00", "399.00")):
            with self.assertRaises(G):
                paper.check_order(bracket(stop_loss={"stop_price": sl}, take_profit={"limit_price": tp}),
                                  ctx(price=400.0))

    def test_bracket_whole_shares_need_no_fractionable(self):
        a = dict(ASSET, fractionable=False)
        self.assertIsNone(paper.check_order(bracket(), ctx(price=400.0, asset=a)))
        with self.assertRaises(G):
            paper.check_order(buy(), ctx(asset=a))
        with self.assertRaises(G):
            paper.check_order(bracket(), ctx(price=400.0, asset={"class": "us_option", "tradable": True,
                                                                  "status": "active"}))

    def test_bracket_prices(self):
        self.assertEqual(paper.bracket_prices(100.0, 98.567, 103.001), (98.56, 103.01))
        self.assertIsNone(paper.bracket_prices(100.004, 100.0, 100.02))  # stop not a cent under

    def test_bracket_exit(self):
        legs = [{"type": "limit", "status": "held"}, {"type": "stop", "status": "new"}]
        self.assertIsNone(paper.bracket_exit({"legs": legs}))
        self.assertIsNone(paper.bracket_exit({}))
        tp = dict(legs[0], status="filled", filled_avg_price="103.01", filled_at="2026-10-29T15:54:49Z")
        self.assertEqual(paper.bracket_exit({"legs": [tp, dict(legs[1], status="canceled")]}),
                         (103.01, "target", "2026-10-29T15:54:49Z"))
        sl = dict(legs[1], status="filled", filled_avg_price="98.50", filled_at=None)
        self.assertEqual(paper.bracket_exit({"legs": [dict(legs[0], status="canceled"), sl]}), (98.5, "stop", None))

    def test_free_slot(self):
        open_ = [{"strategy": "orb"}] * paper.SLOTS["orb"]
        self.assertFalse(paper.free_slot("orb", open_))
        self.assertTrue(paper.free_slot("oversold_bounce", open_))
        self.assertFalse(paper.free_slot("breakout_20d", []))  # not traded live, no slots
        self.assertEqual(sum(paper.SLOTS.values()), paper.MAX_OPEN)

    def test_et_clock(self):
        self.assertEqual(paper.et_clock("2026-10-29T18:02:54.486686Z"), "14:02:54")

    def test_request_refuses_other_hosts(self):
        for url in ("https://api.alpaca.markets/v2/orders", "https://example.com/x"):
            with self.assertRaises(G):
                paper.request("GET", url)


if __name__ == "__main__":
    unittest.main()
