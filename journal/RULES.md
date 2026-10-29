# Paper-Trading-Experiment: Regeln und Stand

Stand: 2026-10-29. Fork: `rKashiki/day-trader-skill`. Werkzeug: `trader-paper/paper.py` (Code per Pull Request).

## Harte Regeln (vom Kontoinhaber vorgegeben)

- Nur Paper-Konto: Host `paper-api.alpaca.markets`. **Niemals** `api.alpaca.markets` (Live).
- Keine Optionen, kein Margin, keine Leerverkäufe.
- Echtgeld nur nach ausdrücklicher Freigabe, dann mit Bestätigung pro Order.
- Handelbar ist alles, was die Plugins vorsehen, innerhalb der Regeln oben.

## Positionsgröße und Risiko

| Limit | Wert |
|---|---|
| Größe pro Position | Übungsphase: bis 2 500 USD, Standard 2 000 USD (notional-Order) |
| Max. offene Positionen | 10 (also höchstens ca. 20 000 USD im Markt) |
| Max. Trades pro Tag | 40, höchstens 10 pro Strategie |
| Max. Tagesverlust | 2 000 USD, danach keine neuen Trades an dem Tag |
| Haltedauer | nur innerhalb des Tages, nichts über Nacht |
| Verlustbremse | Stop-Order auf dem Alpaca-Server direkt nach dem Kauf (Bracket-Orders gehen bei Bruchteilen nicht) |
| Gewinnmitnahme | beim Schließ-Lauf am Nachmittag |

Prüfung vor jeder Order im Code: Abbruch, wenn der Host nicht der Paper-Host ist, wenn der Betrag nicht zwischen 2 und 2 500 USD liegt,
wenn die Assetklasse eine Option ist, wenn ein Verkauf keine passende Long-Position hat oder wenn das Cash nicht reicht.

## Kontostand am 2026-10-29 (nur gelesen, Rohdaten in `account/`)

- Konto `PA38DBA58`, Status ACTIVE, Cash/Equity 100 000 USD, keine Positionen.
- `multiplier: 4`, Kaufkraft 400 000 USD (Margin möglich).
- `shorting_enabled: true`, `options_trading_level: 3`, `crypto_status: ACTIVE`.
- Kontoeinstellungen: `no_shorting: false`, `max_margin_multiplier: "1"`, `fractional_trading: true`.

## Kontosperre (ausgeführt am 2026-10-29, auf ausdrückliche Freigabe)

```
PATCH /v2/account/configurations
{"no_shorting": true, "max_margin_multiplier": "1"}
```
Ergebnis: `multiplier: 1`, `shorting_enabled: false`, Kaufkraft = Cash = 100 000 USD.
Das Senken der Options-Stufe auf 0 hat Alpaca abgelehnt (HTTP 422: Minimum ist 3). Das Optionsverbot
gilt deshalb **nur im Code**: Die Prüfung vor jeder Order lehnt alles ab, was keine Aktie oder (falls das Plugin es vorsieht) Krypto ist.

## Zeitplan (Zeiten in New Yorker Zeit, America/New_York)

| Lauf | Cron | Aufgabe |
|---|---|---|
| Vormittag | `47 9 * * 1-5` | Uhr und Kalender prüfen, Signale holen, bis zu 5 Positionen öffnen, Stop-Orders setzen, Logbuch schreiben |
| Halber Tag | `43 12 * * 1-5` | nur wenn heute um 13:00 geschlossen wird: alles schließen und Logbuch schreiben |
| Nachmittag | `43 15 * * 1-5` | alles schließen, P&L ermitteln, jeden Trade analysieren, Strichliste aktualisieren, committen |

Ist das heutige Datum nicht in `/v2/calendar`, beendet sich jeder Lauf sofort.
Börsenfrei bis Jahresende: 26.11. (Thanksgiving) und 25.12. Halbe Tage bis 13:00: 27.11. und 24.12.
Bis 31.12. gibt es 44 Handelstage.

## Strategien (aus dem Plugin)

| Strategie | Einstieg | Stop | Ziel |
|---|---|---|---|
| `orb` | 15-Min-Opening-Range-Breakout (`orb_hit`), 9:50–11:30 ET | Mitte der Opening Range | 2R |
| `breakout_20d` (nur Backtest) | Tages-Setup, Einstieg 10:00 ET, wenn über der ersten 5-Min-Kerze | 1,5 × ATR(14) der 5-Min-Kerzen | 2R |
| `bull_flag` | wie oben | wie oben | 2R |
| `reclaim_ma20` (nur Backtest) | wie oben | wie oben | 2R |
| `oversold_bounce` | wie oben | wie oben | 2R |

Alle Positionen werden um 15:55 ET geschlossen (an halben Tagen 12:55).

## Wann der Code geändert wird

- Nur im Wochenrückblick (freitags), nie wegen eines einzelnen Trades.
- Eine Hypothese braucht mindestens ca. 20 Trades als Grundlage.
- Jede Änderung wird erst mit trader-timemachine getestet: mindestens 6 Monate Historie plus ein zurückgehaltener Testzeitraum.
- Übernommen wird sie nur, wenn der Testzeitraum besser abschneidet und der Drawdown nicht schlechter wird.
- Bewertet wird nach der prozentualen Rendite vor Gebühren. Netto-Werte in USD stehen trotzdem im Logbuch.

## Geplante Ordnerstruktur im Fork

```
journal/
  RULES.md              # diese Datei
  tally.md              # Strichliste: Gewinne/Verluste, Trefferquote, P&L in % und USD
  trades.csv            # eine Zeile pro Trade
  days/YYYY/YYYY-MM-DD.md   # Tageslogbuch: Strategie, Begründung, Analyse pro Trade
  weekly/YYYY-Www.md    # Wochenrückblick und Hypothesen
  backtests/            # trader-timemachine-Ergebnisse
  STRATEGY_CHANGELOG.md # Code-Änderungen mit Begründung und Backtest
  account/              # Konto-Momentaufnahmen
  calendar_2026.json
```

## Offene Punkte

1. Zugriff auf den Fork fehlt (GitHub verbinden, Claude App für `Mkashiki/day-trader-skill` installieren).
2. Plugin gelesen: nur US-Aktien, kein Krypto. Marktdaten über Alpaca (Yahoo/Nasdaq Trader sind hier gesperrt).
3. Kontosperre erledigt (Optionen nur im Code gesperrt, siehe oben).
4. Entschieden: Code per Pull Request, Logbuch und Strichliste direkt auf `main`.
5. Prüfen, ob das Paper-Konto SEC-/TAF-Gebühren simuliert. Bei 1–2 USD wären das bis zu 2 % pro Verkauf.
