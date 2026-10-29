import unittest

from _load import load

paper = load("trader-paper", "paper")
G = paper.GuardError
ASSET = {"class": "us_equity", "tradable": True, "fractionable": True, "status": "active"}


def buy(**kw):
    o = {"symbol": "AAPL", "notional": "4.00", "side": "buy", "type": "market", "time_in_force": "day"}
    o.update(kw)
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
        for n in ("1.99", "5.01", "100", None, "x"):
            with self.assertRaises(G):
                paper.check_order(buy(notional=n), ctx())
        for n in ("2", "5", "3.5"):
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

    def test_request_refuses_other_hosts(self):
        for url in ("https://api.alpaca.markets/v2/orders", "https://example.com/x"):
            with self.assertRaises(G):
                paper.request("GET", url)


if __name__ == "__main__":
    unittest.main()
