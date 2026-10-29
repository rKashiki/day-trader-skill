# Strategie-Änderungen

Jede Änderung braucht einen Backtest. Übernommen wird nur, was im Testzeitraum (Out-of-Sample) hält.

## 2026-10-29: Erster Backtest, zwei Tages-Setups nicht mehr live handeln

**Daten:** 92 meistgehandelte US-Aktien, 5-Minuten-SIP-Kerzen von Alpaca, 124 Handelstage (04.05. bis 28.10.2026).
Lernzeitraum (In-Sample) bis 03.09., Testzeitraum (Out-of-Sample) ab 04.09. Slippage 0,02 % je Seite.
Jedes Signal wurde genommen. Ergebnisse liegen in `backtests/2026-10-29-*`.

**Grundeinstellung (Ziel 2R, Stop 1,5 × ATR für Tages-Setups, Mitte der Opening Range für orb):**

| Strategie | Trades | Treffer IS / OOS | Ø R IS / OOS | Profit-Faktor IS / OOS |
|---|---|---|---|---|
| orb | 5 098 | 41 % / 40 % | −0,04 / −0,03 | 0,92 / 0,94 |
| breakout_20d | 652 | 43 % / 38 % | −0,06 / −0,23 | 0,88 / 0,58 |
| reclaim_ma20 | 317 | 37 % / 39 % | −0,11 / −0,06 | 0,81 / 0,88 |
| bull_flag | 174 | 53 % / 38 % | +0,17 / −0,04 | 1,40 / 0,93 |
| oversold_bounce | 97 | 38 % / 60 % | −0,07 / +0,35 | 0,87 / 1,95 |

**Getestete Varianten:** Ziel 1R, 1,5R und 3R; Stop 1 × und 2,5 × ATR.
Keine Variante war in beiden Zeiträumen besser als die Grundeinstellung, deshalb bleibt sie.

**Entscheidung:**
- `breakout_20d` und `reclaim_ma20` verlieren in beiden Zeiträumen und in allen sechs Varianten.
  Das ist das einzige robuste Ergebnis. Beide bleiben im Backtest, werden aber nicht mehr live gehandelt.
- `orb` liegt knapp unter null. Die Stichprobe ist groß, also gibt es hier keinen Vorteil, aber auch keinen großen Schaden.
  Bleibt live, um Daten aus echten Ausführungen zu sammeln.
- `bull_flag` und `oversold_bounce` sind positiv, aber nicht in beiden Zeiträumen.
  Mit 174 bzw. 97 Trades ist das zu wenig für eine Aussage. Bleiben live als Beobachtung.

**Nächste Hypothesen (vorher festgelegt, noch nicht getestet):**
1. orb nur, wenn die Aktie im Tagestrend liegt (Schluss über dem 20-Tage-Durchschnitt).
2. orb nur bei überdurchschnittlichem Volumen in der Opening Range.
3. Größeres Universum: weniger Verzerrung, weil nur heute aktive Aktien drin sind (Survivorship Bias).
