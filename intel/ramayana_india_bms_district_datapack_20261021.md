# Ramayana: Rise of a Legend — India presale data pack
## BookMyShow and District, read 21 October 2026

Prepared by Boxoffy.com for an independent statistical model.
Release date 5 November 2026. **All figures on this page are 5 November only** —
opening day, single date. Presales run to 12 November but are not in this file.

---

## WHAT THIS FILE IS FOR

District gives us measured seats and measured rupees for India. BookMyShow is
the larger consumer platform and gives us nothing but fullness labels. The task
is to turn those labels into a defensible ticket count and rupee value, or to
establish that it cannot be done and say why.

Boxoffy has not published a BookMyShow ticket figure and will not publish one
without an interval it can defend. The published Indian figure is District's
alone and says so on the page.

## HOW TO READ THE SECTIONS

| section | what it holds |
|---|---|
| **A** | District — the calibration set. Real seats, real money, its own labels. |
| **B** | BookMyShow — the thing to be modelled. Labels and prices only. |
| **C** | The city-level join. Where the two platforms describe the same place. |
| **D** | **The showtime pairing.** A BookMyShow label against a District seat count, same city, same minute. This is the most useful part of the file. |
| **E** | What is missing, the double-count problem, a worked naive estimate, and what would be most useful back. |

If you read one section, read **D**.

## FIVE THINGS THAT WILL OTHERWISE COST YOU AN HOUR

1. **BookMyShow's `worstLabel` is a seat class, not a showtime.** A showtime
   reads `SOLD OUT` when its fullest class is gone. In the 25 paired cases in
   D1, those showtimes are a median **25.4%** full — not 95%. `nCat` and
   `soldOutCats` are in the D2 table so the label can be conditioned on how
   many classes the room actually has.

2. **The same words mean different things on the two platforms.** District's
   `Filling Fast` is a median 72.1% full (A2). BookMyShow's `FILLING FAST`,
   paired against a real seat count, is a median 15.3% full (D1). Do not carry
   one platform's label meanings to the other.

3. **96% of BookMyShow's footprint sits on top of District's.** 2,651 of 2,751
   BookMyShow showtimes fall in a (city, minute) bucket District also lists.
   A BookMyShow total is therefore **not additive** to District's 46,539. The
   question worth answering is the incremental one. See E2.

4. **Some of District's 46,539 is not a sale.** 12,206 tickets across 167
   rooms are a standing house block — the same count on every showtime in a
   room, never moving. Boxoffy publishes both figures: 46,539 gross and 34,333
   after blocks. The occupancy in C and D is **gross**, blocks included, so
   that D can be checked against the raw CSV. Any model output should say which
   basis it is on.

5. **Blank is not zero.** A showtime that failed to read is absent, not a zero.
   Every row in these tables read successfully.

## PROVENANCE

| | |
|---|---|
| District sweep | `district_shows.csv`, 3,129 rows, one per showtime, read 21 Oct ~02:55 IST |
| BookMyShow sweep | `bms_shows.csv` 2,751 rows + `bms_seat_classes.csv` 10,184 rows, read 21 Oct ~03:05 IST |
| Gap between the two reads | about 10 minutes |
| Method | public pages only, GET only, robots.txt honoured, no booking path ever entered, no login, no estimate substituted for a failed read |
| FX used for any dollar figure | INR 1 = USD 0.0105, valutafx, 19 Oct |
| Digit grouping | Indian — 46,539 and 2,95,74,423 |

Capacity is not published anywhere on BookMyShow outside the booking funnel,
and the booking funnel is past seat selection, which we do not enter. That is
why section B has no seat count. It is a boundary, not an oversight.

---

## A. DISTRICT - THE CALIBRATION SET (has BOTH a label and real seats)

| metric | value |
|---|---|
| showtimes | 3,129 |
| cinemas | 321 |
| cities | 71 |
| states | 20 |
| seats | 664,246 |
| tickets sold | 46,539 |
| occupancy | 7.01% |
| gross | Rs 29,574,423 |
| ATP | Rs 635 |
| sold-out shows | 0 |

### A1. District capacity distribution (seats per showtime)

| p5 | p10 | p25 | median | mean | p75 | p90 | p95 | max |
|---|---|---|---|---|---|---|---|---|
| 50 | 77 | 148 | 211 | 212 | 272 | 331 | 377 | 568 |

### A2. District occupancy BY ITS OWN FULLNESS LABEL

District publishes its own fullness label alongside a real seat count, so this
table is self-contained. **But read it against Section D1 before using it.**
District's `Filling Fast` sits at a median 72.1% full. BookMyShow's
`FILLING FAST`, paired to a District seat count in D1, sits at a median 15.3%.
The two platforms use the same words to mean very different things, and a model
that carries District's label meanings over to BookMyShow will be out by 4-5x.

| label | n | mean% | p10 | p25 | median | p75 | p90 | max |
|---|---|---|---|---|---|---|---|---|
| Filling Fast | 14 | 71.0 | 62.0 | 64.4 | 72.1 | 79.9 | 80.8 | 81.8 |
| Available | 3115 | 6.1 | 0.0 | 0.0 | 2.9 | 8.1 | 17.6 | 59.8 |

### A3. District occupancy distribution overall (all shows)

| p10 | p25 | median | mean | p75 | p90 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|---|
| 0.0 | 0.0 | 2.9 | 6.4 | 8.2 | 17.9 | 25.3 | 47.8 | 81.8 |

Shows with zero sold: 889 of 3,129 (28%)

### A4. District by chain

| chain | showtimes | cinemas | seats | sold | occ% | ATP Rs |
|---|---|---|---|---|---|---|
| PVR | 2,217 | 220 | 458,163 | 31,227 | 6.82 | 705 |
| Cinepolis | 527 | 58 | 114,966 | 7,258 | 6.31 | 594 |
| miraj | 381 | 42 | 89,009 | 6,352 | 7.14 | 453 |
| TicketNew | 4 | 1 | 2,108 | 1,702 | 80.74 | 211 |

---

## B. BOOKMYSHOW - THE THING TO MODEL

| metric | value |
|---|---|
| showtimes | 2,751 |
| distinct sessionIds | 2,724 |
| cities | 37 |
| states | 18 |
| seat classes | 10,184 |
| venues | **NOT AVAILABLE - field empty on every row** |
| capacity | **NOT PUBLISHED ANYWHERE** |
| seats sold | **NOT PUBLISHED ANYWHERE** |

### B1. Seat-class fullness labels (the only occupancy signal)

| label | classes | share |
|---|---|---|
| AVAILABLE | 9,653 | 94.79% |
| FILLING FAST | 351 | 3.45% |
| ALMOST FULL | 94 | 0.92% |
| SOLD OUT | 86 | 0.84% |

### B2. Per-SHOW worst label (worst of its own classes)

| worst label on the show | shows | share |
|---|---|---|
| AVAILABLE | 2,310 | 83.97% |
| FILLING FAST | 262 | 9.52% |
| SOLD OUT | 70 | 2.54% |
| ALMOST FULL | 68 | 2.47% |
| (none) | 41 | 1.49% |

### B3. Classes per show (nCat)

| classes on the show | shows |
|---|---|
| 0 | 41 |
| 1 | 114 |
| 2 | 482 |
| 3 | 553 |
| 4 | 679 |
| 5 | 583 |
| 6 | 277 |
| 7 | 22 |

### B4. Sold-out classes per show

| sold-out classes | shows |
|---|---|
| 0 | 2,681 |
| 1 | 54 |
| 2 | 16 |

### B5. BMS seat-class PRICES (real, printed on the page)

| n | min | p10 | p25 | median | mean | p75 | p90 | p99 | max |
|---|---|---|---|---|---|---|---|---|---|
| 10,184 | 200 | 310 | 370 | 440 | 559 | 610 | 920 | 2250 | 2920 |

District's observed ATP for comparison: **Rs 635**
Price by label (does a fuller class cost more?):

| label | n priced | median Rs | mean Rs |
|---|---|---|---|
| ALMOST FULL | 94 | 900 | 1035 |
| SOLD OUT | 86 | 790 | 895 |
| FILLING FAST | 351 | 680 | 845 |
| AVAILABLE | 9,653 | 440 | 541 |

### B6. BMS languages

| language code | shows |
|---|---|
| Hindi | 2,628 |
| UNLABELLED | 78 |
| Kannada | 45 |

### B7. BMS by time of day (IST)

| hour band | shows | shows w/ sold-out class |
|---|---|---|
| 00-04 | 582 | 17 |
| 04-07 | 413 | 13 |
| 07-10 | 825 | 18 |
| 10-13 | 931 | 22 |

---

## C. THE CITY JOIN - the only bridge between the two platforms

District gives seats and rupees but barely any fullness signal: of 3,129
showtimes, 3,115 read 'Available' and 14 read 'Filling Fast'. Zero sold out.
BookMyShow gives four fullness labels including 86 SOLD OUT seat classes,
but publishes no capacity anywhere outside the booking funnel.

Neither platform is modellable alone. This is where they overlap: the same
city, read within about three hours of each other on 21 October.

Two joins are worth knowing about before you use the table:

- BookMyShow sells Delhi as ONE region, `Delhi-NCR`. District lists the same
  territory as six cities: New Delhi, Ghaziabad, Noida, Greater Noida,
  Gurgaon, Faridabad. District's six are summed into the single Delhi-NCR
  row below. It is the largest market on both platforms, so leaving it
  unjoined would have removed the most informative row in the pack.
- Other aliases applied: Bangalore=Bengaluru, Trivandrum=Thiruvananthapuram,
  Mysore=Mysuru, Vizag=Visakhapatnam, Pondicherry=Puducherry. Nothing else
  was matched. Unmatched cities are listed in C2 and C3 rather than forced.

### C1. Cities present on BOTH platforms - 33 of them

`D_` = District (seats, money, capacity). `B_` = BookMyShow (labels, prices).
`D_ATP` is rupees divided by tickets and is the only per-ticket figure in
this pack taken from money actually read off a page rather than a list price.
`B_px_*` are LISTED prices from the seat-class rows, which is a different
thing - a price on offer, not a price paid.

| city | D_shows | D_cin | D_seats | D_sold | D_occ% | D_rupees | D_ATP | D_medcap | D_fillfast | B_shows | B_SO | B_AF | B_FF | B_AV | B_classes | B_cls_SO | B_px_lo | B_px_med | B_px_hi |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Delhi-NCR * | 760 | 80 | 144,828 | 12,135 | 8.38 | 10,050,357 | 828 | 187 | 8 | 730 | 12 | 27 | 73 | 618 | 2412 | 13 | 200 | 480 | 2400 |
| Mumbai | 430 | 34 | 94,647 | 7,387 | 7.80 | 5,408,750 | 732 | 229 | 0 | 527 | 11 | 6 | 58 | 452 | 2007 | 17 | 240 | 540 | 2770 |
| Pune | 211 | 14 | 45,150 | 2,378 | 5.27 | 1,959,960 | 824 | 220 | 0 | 202 | 0 | 2 | 13 | 187 | 804 | 0 | 240 | 500 | 2920 |
| Jaipur | 97 | 10 | 22,503 | 2,375 | 10.55 | 1,150,720 | 485 | 226 | 0 | 92 | 9 | 5 | 16 | 62 | 410 | 9 | 240 | 440 | 1150 |
| Kolkata | 146 | 16 | 39,340 | 2,277 | 5.79 | 1,436,510 | 631 | 273 | 2 | 156 | 4 | 2 | 6 | 144 | 592 | 4 | 260 | 400 | 1920 |
| Bengaluru | 4 | 1 | 2,108 | 1,702 | 80.74 | 359,750 | 211 | 527 | 4 | 29 | 1 | 4 | 2 | 22 | 58 | 1 | 200 | 500 | 1000 |
| Lucknow | 96 | 9 | 19,935 | 1,223 | 6.13 | 823,620 | 673 | 202 | 0 | 88 | 0 | 3 | 2 | 83 | 284 | 0 | 260 | 450 | 1000 |
| Bhubaneswar | 42 | 5 | 9,811 | 931 | 9.49 | 408,300 | 439 | 196 | 0 | 42 | 0 | 1 | 15 | 26 | 166 | 0 | 270 | 450 | 1350 |
| Nagpur | 23 | 2 | 5,097 | 825 | 16.19 | 617,350 | 748 | 205 | 0 | 23 | 14 | 0 | 0 | 9 | 101 | 23 | 280 | 450 | 1550 |
| Raipur | 41 | 5 | 8,927 | 758 | 8.49 | 363,540 | 480 | 197 | 0 | 41 | 3 | 5 | 10 | 23 | 179 | 3 | 220 | 370 | 780 |
| Ahmedabad | 126 | 11 | 25,131 | 689 | 2.74 | 325,106 | 472 | 173 | 0 | 134 | 0 | 0 | 0 | 116 | 433 | 0 | 200 | 390 | 1020 |
| Patna | 32 | 4 | 6,689 | 679 | 10.15 | 326,400 | 481 | 184 | 0 | 32 | 1 | 0 | 5 | 26 | 145 | 1 | 250 | 470 | 1230 |
| Indore | 75 | 5 | 13,265 | 621 | 4.68 | 304,710 | 491 | 179 | 0 | 65 | 0 | 0 | 10 | 55 | 265 | 0 | 270 | 460 | 1180 |
| Ranchi | 21 | 3 | 5,133 | 602 | 11.73 | 271,510 | 451 | 213 | 0 | 21 | 1 | 3 | 8 | 9 | 79 | 1 | 270 | 380 | 960 |
| Surat | 70 | 5 | 13,974 | 549 | 3.93 | 214,400 | 391 | 214 | 0 | 65 | 0 | 0 | 0 | 65 | 256 | 0 | 210 | 380 | 800 |
| Nashik | 14 | 1 | 2,688 | 531 | 19.75 | 231,780 | 436 | 191 | 0 | 14 | 0 | 4 | 7 | 3 | 42 | 0 | 250 | 440 | 660 |
| Guwahati | 37 | 4 | 6,230 | 522 | 8.38 | 224,610 | 430 | 200 | 0 | 37 | 0 | 1 | 6 | 30 | 141 | 0 | 280 | 390 | 1000 |
| Chandigarh | 43 | 5 | 9,812 | 464 | 4.73 | 213,870 | 461 | 233 | 0 | 84 | 1 | 2 | 6 | 75 | 354 | 1 | 210 | 370 | 2050 |
| Bhopal | 42 | 5 | 8,412 | 360 | 4.28 | 155,090 | 431 | 193 | 0 | 42 | 3 | 2 | 0 | 37 | 171 | 3 | 260 | 430 | 2160 |
| Kanpur | 24 | 4 | 5,535 | 315 | 5.69 | 129,990 | 413 | 218 | 0 | 24 | 0 | 0 | 2 | 22 | 80 | 0 | 250 | 400 | 1340 |
| Thiruvananthapuram | 4 | 1 | 1,166 | 313 | 26.84 | 267,180 | 854 | 291 | 0 | 4 | 0 | 0 | 3 | 1 | 20 | 0 | 650 | 800 | 1200 |
| Dehradun | 28 | 3 | 4,146 | 300 | 7.24 | 161,580 | 539 | 129 | 0 | 24 | 0 | 0 | 2 | 22 | 108 | 0 | 300 | 460 | 940 |
| Kochi | 5 | 1 | 1,145 | 274 | 23.93 | 241,950 | 883 | 229 | 0 | 5 | 0 | 0 | 4 | 1 | 25 | 0 | 750 | 850 | 950 |
| Vadodara | 67 | 6 | 14,005 | 251 | 1.79 | 94,160 | 375 | 182 | 0 | 67 | 1 | 1 | 1 | 50 | 200 | 1 | 220 | 380 | 830 |
| Jamshedpur | 16 | 2 | 3,486 | 234 | 6.71 | 89,630 | 383 | 263 | 0 | 16 | 0 | 0 | 0 | 16 | 60 | 0 | 260 | 340 | 800 |
| Goa | 37 | 4 | 9,022 | 204 | 2.26 | 106,930 | 524 | 209 | 0 | 37 | 0 | 0 | 1 | 36 | 143 | 0 | 260 | 410 | 910 |
| Siliguri | 23 | 3 | 5,916 | 188 | 3.18 | 76,720 | 408 | 250 | 0 | 23 | 0 | 0 | 4 | 19 | 69 | 0 | 270 | 340 | 480 |
| Ludhiana | 32 | 4 | 7,583 | 169 | 2.23 | 79,310 | 469 | 231 | 0 | 32 | 0 | 0 | 1 | 31 | 168 | 0 | 260 | 410 | 900 |
| Amritsar | 24 | 3 | 4,942 | 141 | 2.85 | 56,650 | 402 | 177 | 0 | 24 | 0 | 0 | 1 | 23 | 122 | 0 | 260 | 370 | 800 |
| Agra | 8 | 1 | 962 | 121 | 12.58 | 52,180 | 431 | 120 | 0 | 8 | 0 | 0 | 3 | 5 | 40 | 0 | 270 | 380 | 570 |
| Jammu | 4 | 1 | 504 | 117 | 23.21 | 55,270 | 472 | 126 | 0 | 4 | 2 | 0 | 1 | 1 | 20 | 2 | 330 | 440 | 760 |
| Rajkot | 15 | 3 | 2,820 | 73 | 2.59 | 29,820 | 408 | 199 | 0 | 15 | 0 | 0 | 0 | 10 | 45 | 0 | 300 | 380 | 480 |
| Jalandhar | 28 | 4 | 5,404 | 64 | 1.18 | 33,260 | 520 | 176 | 0 | 28 | 0 | 0 | 1 | 27 | 148 | 0 | 320 | 430 | 820 |

`*` = District's six NCR cities summed to match BookMyShow's one region.

**Joined subtotal.**

- District: 2,625 showtimes, 259 cinemas, 550,316 seats, 39,772 tickets, 7.23% sold, Rs 26,320,963, ATP Rs 662, 14 'Filling Fast'.
- BookMyShow: 2,735 showtimes, of which 63 worst-label SOLD OUT, 68 ALMOST FULL, 261 FILLING FAST, 2306 AVAILABLE.
- BookMyShow seat classes in these cities: 10,147, of which 79 SOLD OUT.

That subtotal is 85.5% of District's national tickets and 89.0% of its
rupees, and 99.4% of BookMyShow's showtimes. Whatever relationship holds
here is the relationship a model has to lean on.

### C2. BookMyShow cities District does NOT see - 4

No local seats, no local rupees, labels only. If an estimate is going to be
wrong anywhere it is going to be wrong here.

| city | B_shows | B_SO | B_AF | B_FF | B_AV | B_classes | B_cls_SO | B_px_med |
|---|---|---|---|---|---|---|---|---|
| Udupi | 8 | 0 | 0 | 0 | 4 | 12 | 0 | 350 |
| Shivamogga | 4 | 4 | 0 | 0 | 0 | 16 | 4 | 400 |
| Mysuru | 3 | 3 | 0 | 0 | 0 | 6 | 3 | 555 |
| Tumakuru | 1 | 0 | 0 | 1 | 0 | 3 | 0 | 250 |

### C3. District cities BookMyShow does NOT see - 33

A BookMyShow estimate must not be spread over these. BMS returned no link
for them, which means not listed on that platform - not no demand.

| city | D_shows | D_cin | D_seats | D_sold | D_occ% | D_rupees | D_ATP |
|---|---|---|---|---|---|---|---|
| Ulhasnagar | 14 | 1 | 5,873 | 896 | 15.26 | 343,220 | 383 |
| Mohali | 34 | 3 | 5,246 | 594 | 11.32 | 354,970 | 598 |
| Jodhpur | 27 | 3 | 6,609 | 480 | 7.26 | 199,490 | 416 |
| Navi Mumbai | 40 | 4 | 9,335 | 479 | 5.13 | 395,930 | 827 |
| Thane | 41 | 4 | 8,305 | 458 | 5.51 | 454,960 | 993 |
| Ambernath | 9 | 1 | 2,457 | 429 | 17.46 | 157,380 | 367 |
| Aurangabad | 21 | 2 | 5,459 | 411 | 7.53 | 176,030 | 428 |
| Muzaffarpur | 28 | 3 | 5,254 | 347 | 6.60 | 118,700 | 342 |
| Gwalior | 26 | 3 | 5,333 | 316 | 5.93 | 132,900 | 421 |
| Kota | 22 | 3 | 6,306 | 254 | 4.03 | 86,610 | 341 |
| Gorakhpur | 16 | 3 | 2,980 | 220 | 7.38 | 87,290 | 397 |
| Bareilly | 4 | 1 | 888 | 208 | 23.42 | 99,950 | 481 |
| Bhilai | 9 | 1 | 1,897 | 203 | 10.70 | 78,010 | 384 |
| Kolhapur | 20 | 2 | 4,905 | 203 | 4.14 | 76,840 | 379 |
| Ujjain | 5 | 1 | 1,360 | 198 | 14.56 | 62,800 | 317 |
| Jabalpur | 14 | 2 | 2,422 | 174 | 7.18 | 72,080 | 414 |
| Cuttack | 10 | 1 | 1,997 | 158 | 7.91 | 73,380 | 464 |
| Dhanbad | 18 | 2 | 4,065 | 154 | 3.79 | 46,240 | 300 |
| Ajmer | 13 | 2 | 2,229 | 106 | 4.76 | 46,450 | 438 |
| Howrah | 15 | 2 | 4,110 | 69 | 1.68 | 25,850 | 375 |
| Udaipur | 26 | 3 | 5,305 | 63 | 1.19 | 31,970 | 507 |
| Panipat | 13 | 2 | 3,093 | 61 | 1.97 | 24,310 | 399 |
| Bokaro | 5 | 1 | 1,405 | 53 | 3.77 | 19,270 | 364 |
| Jalgaon | 5 | 1 | 1,045 | 53 | 5.07 | 13,430 | 253 |
| Moradabad | 4 | 1 | 860 | 52 | 6.05 | 20,470 | 394 |
| Vasai | 1 | 1 | 250 | 40 | 16.00 | 16,400 | 410 |
| Amravati | 13 | 1 | 3,151 | 23 | 0.73 | 11,560 | 503 |
| Zirakpur | 12 | 2 | 2,676 | 23 | 0.86 | 10,270 | 447 |
| Patiala | 17 | 2 | 3,906 | 18 | 0.46 | 8,220 | 457 |
| Gandhinagar | 5 | 1 | 1,980 | 11 | 0.56 | 4,500 | 409 |
| Anand | 5 | 1 | 1,245 | 8 | 0.64 | 2,240 | 280 |
| Sanand | 8 | 1 | 996 | 3 | 0.30 | 1,220 | 407 |
| Panchkula | 4 | 1 | 988 | 2 | 0.20 | 520 | 260 |

These 33 cities carry 6,767 District tickets, 14.5% of the national District
total. They are real sales with no BookMyShow counterpart at all.

---

## D. SHOWTIME PAIRING - a label on one platform against a seat count on the other

This is the part of the pack worth the most, and it exists only because both
platforms publish an exact start minute.

BookMyShow's venue fields came back empty on all 2,751 rows, so the two
platforms cannot be joined on cinema. But where a city has exactly ONE
District showtime at a given minute and exactly ONE BookMyShow showtime at
the same minute, that pair is near-certainly the same screening. That turns a
BookMyShow label into a measured District occupancy and a measured rupee
figure - with no capacity assumption anywhere in the chain.

It is also the only place `SOLD OUT` and `ALMOST FULL` get any empirical
anchor at all, because District produced zero of either across 3,129 shows.

**Counts.** 1103 (city, minute) buckets appear on both platforms. 597 of them
are strictly one-to-one and are the calibration set below. 506 are n-to-m and
are reported separately as ranges, not averaged into the clean set.

### D1. One-to-one pairs, grouped by the BookMyShow label

The question a model has to answer is: when BookMyShow says SOLD OUT, what
fraction of the room is actually gone? These rows are the evidence.

| BMS label | n pairs | occ min | occ p25 | occ median | occ p75 | occ max | mean occ | mean cap | tickets | rupees |
|---|---|---|---|---|---|---|---|---|---|---|
| SOLD OUT | 25 | 9.5 | 18.2 | 25.4 | 33.8 | 49.0 | 26.0 | 184 | 1,176 | 810,750 |
| ALMOST FULL | 21 | 6.6 | 16.9 | 22.5 | 34.5 | 59.4 | 27.6 | 255 | 1,643 | 1,084,170 |
| FILLING FAST | 78 | 0.0 | 9.1 | 15.3 | 23.6 | 44.7 | 16.6 | 239 | 3,222 | 1,922,840 |
| AVAILABLE | 468 | 0.0 | 0.0 | 2.4 | 5.4 | 80.8 | 4.3 | 200 | 4,863 | 2,040,080 |
| NONE | 5 | 0.0 | 3.8 | 4.5 | 4.5 | 5.3 | 3.6 | 133 | 24 | 10,560 |

### D2. Every one-to-one pair, in full

All 597 of them, so the table above can be checked rather than trusted.
Sorted by BookMyShow label severity then by occupancy.

| city | time | BMS label | BMS classes | BMS SO classes | BMS price lo-hi | District cinema | screen | capacity | sold | occ% | rupees | District label |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Nagpur | 07:00 | SOLD OUT | 4 | 1 | 340.0-1050.0 | Cinepolis VR Nagpur Mall, Rambagh Road, Nagpur | AUDI 06 | 147 | 72 | 49.0 | 45,200 | Available |
| Nagpur | 19:45 | SOLD OUT | 5 | 2 | 580.0-1550.0 | Cinepolis VR Nagpur Mall, Rambagh Road, Nagpur | AUDI 05 | 205 | 89 | 43.4 | 69,060 | Available |
| Nagpur | 07:30 | SOLD OUT | 5 | 2 | 340.0-1050.0 | Cinepolis VR Nagpur Mall, Rambagh Road, Nagpur | AUDI 05 | 205 | 88 | 42.9 | 45,430 | Available |
| Nagpur | 21:35 | SOLD OUT | 5 | 2 | 580.0-1550.0 | Cinepolis VR Nagpur Mall, Rambagh Road, Nagpur | AUDI 01 | 181 | 72 | 39.8 | 54,650 | Available |
| Nagpur | 15:35 | SOLD OUT | 5 | 2 | 580.0-1550.0 | Cinepolis VR Nagpur Mall, Rambagh Road, Nagpur | AUDI 05 | 205 | 81 | 39.5 | 64,060 | Available |
| Nagpur | 19:15 | SOLD OUT | 4 | 1 | 580.0-1550.0 | Cinepolis VR Nagpur Mall, Rambagh Road, Nagpur | AUDI 06 | 147 | 52 | 35.4 | 55,410 | Available |
| Nagpur | 10:55 | SOLD OUT | 4 | 1 | 380.0-1150.0 | Cinepolis VR Nagpur Mall, Rambagh Road, Nagpur | AUDI 06 | 145 | 49 | 33.8 | 39,770 | Available |
| Nagpur | 15:05 | SOLD OUT | 4 | 1 | 500.0-1350.0 | Cinepolis VR Nagpur Mall, Rambagh Road, Nagpur | AUDI 06 | 145 | 43 | 29.7 | 43,410 | Available |
| Raipur | 21:15 | SOLD OUT | 4 | 1 | 400.0-690.0 | PVR Zora The Mall, Raipur | SCREEN 5 | 174 | 50 | 28.7 | 29,320 | Available |
| Jammu | 13:40 | SOLD OUT | 5 | 1 | 410.0-760.0 | PVR KC, B.C Road, Jammu | AUDI 02 | 126 | 35 | 27.8 | 17,650 | Available |
| Ranchi | 14:50 | SOLD OUT | 5 | 1 | 370.0-730.0 | PVR Nucleus Mall, Lalpur Circular Road, Ranchi | AUDI 02 | 265 | 71 | 26.8 | 34,190 | Available |
| Jammu | 17:30 | SOLD OUT | 5 | 1 | 410.0-760.0 | PVR KC, B.C Road, Jammu | AUDI 02 | 126 | 33 | 26.2 | 16,640 | Available |
| Nagpur | 11:25 | SOLD OUT | 5 | 2 | 380.0-1150.0 | Cinepolis VR Nagpur Mall, Rambagh Road, Nagpur | AUDI 05 | 205 | 52 | 25.4 | 33,980 | Available |
| Nagpur | 23:59 | SOLD OUT | 5 | 2 | 500.0-1350.0 | Cinepolis VR Nagpur Mall, Rambagh Road, Nagpur | AUDI 05 | 205 | 49 | 23.9 | 38,660 | Available |
| Nagpur | 23:25 | SOLD OUT | 4 | 1 | 500.0-1350.0 | Cinepolis VR Nagpur Mall, Rambagh Road, Nagpur | AUDI 06 | 147 | 33 | 22.4 | 37,990 | Available |
| Raipur | 22:05 | SOLD OUT | 5 | 1 | 370.0-780.0 | PVR Magneto The Mall, Magneto Mall, Raipur | AUDI 03 | 276 | 55 | 19.9 | 30,460 | Available |
| Nagpur | 17:20 | SOLD OUT | 5 | 2 | 500.0-1350.0 | Cinepolis VR Nagpur Mall, Rambagh Road, Nagpur | AUDI 01 | 181 | 35 | 19.3 | 27,630 | Available |
| Nagpur | 09:00 | SOLD OUT | 5 | 2 | 340.0-1050.0 | Cinepolis VR Nagpur Mall, Rambagh Road, Nagpur | AUDI 01 | 181 | 34 | 18.8 | 20,870 | Available |
| Nagpur | 13:10 | SOLD OUT | 5 | 2 | 500.0-1350.0 | Cinepolis VR Nagpur Mall, Rambagh Road, Nagpur | AUDI 01 | 181 | 33 | 18.2 | 26,630 | Available |
| Patna | 17:30 | SOLD OUT | 5 | 1 | 350.0-690.0 | Cinepolis P&M Mall, Patliputra Colony, Patna | SCREEN 4 | 180 | 31 | 17.2 | 14,580 | Available |
| Raipur | 17:10 | SOLD OUT | 4 | 1 | 400.0-690.0 | PVR Zora The Mall, Raipur | SCREEN 5 | 174 | 28 | 16.1 | 17,880 | Available |
| Jaipur | 09:45 | SOLD OUT | 5 | 1 | 240.0-410.0 | INOX Sunny Trade Center, Mansarovar, Jaipur | SCREEN 1 | 201 | 24 | 11.9 | 8,240 | Available |
| Jaipur | 13:50 | SOLD OUT | 5 | 1 | 390.0-680.0 | INOX Sunny Trade Center, Mansarovar, Jaipur | SCREEN 1 | 201 | 24 | 11.9 | 13,500 | Available |
| Jaipur | 22:00 | SOLD OUT | 5 | 1 | 410.0-720.0 | INOX Sunny Trade Center, Mansarovar, Jaipur | SCREEN 1 | 201 | 24 | 11.9 | 14,240 | Available |
| Jaipur | 17:55 | SOLD OUT | 5 | 1 | 390.0-680.0 | INOX Sunny Trade Center, Mansarovar, Jaipur | SCREEN 1 | 201 | 19 | 9.5 | 11,300 | Available |
| Lucknow | 14:35 | ALMOST FULL | 3 | 0 | 800.0-900.0 | INOX Megaplex Phoenix Palassio Mall, Amar Sahe | SCREEN 4 | 323 | 192 | 59.4 | 172,800 | Available |
| Lucknow | 10:30 | ALMOST FULL | 3 | 0 | 650.0-750.0 | INOX Megaplex Phoenix Palassio Mall, Amar Sahe | SCREEN 4 | 323 | 188 | 58.2 | 134,000 | Available |
| Delhi-NCR | 10:35 | ALMOST FULL | 3 | 0 | 730.0-990.0 | PVR Vegas, Dwarka, New Delhi | AUDI 03 | 410 | 234 | 57.1 | 199,290 | Available |
| Lucknow | 18:40 | ALMOST FULL | 3 | 0 | 800.0-900.0 | INOX Megaplex Phoenix Palassio Mall, Amar Sahe | SCREEN 4 | 323 | 166 | 51.4 | 143,650 | Available |
| Nashik | 11:45 | ALMOST FULL | 3 | 0 | 250.0-440.0 | Cinemax City Center, City Center Mall, Nashik | SCREEN 5 | 191 | 78 | 40.8 | 25,640 | Available |
| Jaipur | 11:10 | ALMOST FULL | 4 | 0 | 290.0-640.0 | Miraj Cinemas : Entertainment Paradise, Jaipur | SCREEN 1 | 478 | 165 | 34.5 | 64,400 | Available |
| Nashik | 22:00 | ALMOST FULL | 3 | 0 | 410.0-660.0 | Cinemax City Center, City Center Mall, Nashik | SCREEN 2 | 202 | 55 | 27.2 | 31,100 | Available |
| Jaipur | 18:40 | ALMOST FULL | 4 | 0 | 370.0-890.0 | Miraj Cinemas : Entertainment Paradise, Jaipur | SCREEN 3 | 470 | 126 | 26.8 | 66,570 | Available |
| Raipur | 22:30 | ALMOST FULL | 4 | 0 | 320.0-610.0 | PVR City Center, City Center Mall, Raipur | SCREEN 4 | 176 | 44 | 25.0 | 19,250 | Available |
| Nashik | 13:50 | ALMOST FULL | 3 | 0 | 390.0-620.0 | Cinemax City Center, City Center Mall, Nashik | SCREEN 2 | 202 | 48 | 23.8 | 25,980 | Available |
| Delhi-NCR | 12:35 | ALMOST FULL | 2 | 0 | 600.0-650.0 | PVR Promenade, Vasant Kunj, New Delhi | SCREEN 2 | 129 | 29 | 22.5 | 18,850 | Available |
| Delhi-NCR | 16:40 | ALMOST FULL | 2 | 0 | 600.0-650.0 | PVR Promenade, Vasant Kunj, New Delhi | SCREEN 2 | 129 | 29 | 22.5 | 18,850 | Available |
| Nashik | 19:55 | ALMOST FULL | 3 | 0 | 410.0-620.0 | Cinemax City Center, City Center Mall, Nashik | SCREEN 5 | 191 | 34 | 17.8 | 17,560 | Available |
| Raipur | 19:10 | ALMOST FULL | 4 | 0 | 400.0-690.0 | PVR Zora The Mall, Raipur | SCREEN 1 | 307 | 54 | 17.6 | 28,680 | Available |
| Raipur | 18:55 | ALMOST FULL | 5 | 0 | 320.0-610.0 | INOX Ambuja City Centre, Mowa, Raipur | SCREEN 1 | 212 | 36 | 17.0 | 17,330 | Available |
| Ranchi | 17:25 | ALMOST FULL | 4 | 0 | 360.0-960.0 | PJP Cinemas, Mall of Ranchi, Ranchi | AUDI 3 | 189 | 32 | 16.9 | 18,620 | Available |
| Ranchi | 18:55 | ALMOST FULL | 5 | 0 | 400.0-720.0 | PVR Nucleus Mall, Lalpur Circular Road, Ranchi | AUDI 02 | 265 | 44 | 16.6 | 22,370 | Available |
| Jaipur | 19:25 | ALMOST FULL | 5 | 0 | 470.0-940.0 | PVR Mall of Jaipur, Vaishali Nagar, Jaipur | AUDI 04 | 179 | 29 | 16.2 | 19,280 | Available |
| Ranchi | 21:25 | ALMOST FULL | 4 | 0 | 360.0-960.0 | PJP Cinemas, Mall of Ranchi, Ranchi | AUDI 3 | 189 | 26 | 13.8 | 16,710 | Available |
| Raipur | 18:00 | ALMOST FULL | 5 | 0 | 370.0-780.0 | PVR Magneto The Mall, Magneto Mall, Raipur | AUDI 03 | 225 | 18 | 8.0 | 13,320 | Available |
| Jaipur | 19:30 | ALMOST FULL | 5 | 0 | 420.0-920.0 | Cinepolis Jewel of India, Jaipur | AUDI 2 | 241 | 16 | 6.6 | 9,920 | Available |
| Jaipur | 18:25 | FILLING FAST | 1 | 0 | 1150.0-1150.0 | PVR Mall of Jaipur, Vaishali Nagar, Jaipur | AUDI 01 | 38 | 17 | 44.7 | 19,550 | Available |
| Thiruvananthapuram | 19:15 | FILLING FAST | 5 | 0 | 650.0-1200.0 | PVR LULU, Lulu International Shopping Mall, Tr | AUDI 01 | 340 | 130 | 38.2 | 110,420 | Available |
| Delhi-NCR | 14:40 | FILLING FAST | 3 | 0 | 930.0-1230.0 | PVR Vegas, Dwarka, New Delhi | AUDI 03 | 410 | 149 | 36.3 | 156,930 | Available |
| Nashik | 10:45 | FILLING FAST | 3 | 0 | 250.0-440.0 | Cinemax City Center, City Center Mall, Nashik | SCREEN 3 | 202 | 73 | 36.1 | 22,580 | Available |
| Kochi | 07:00 | FILLING FAST | 5 | 0 | 750.0-950.0 | Cinepolis Centre Square Mall, Ernakulam, Kochi | IMAX | 229 | 79 | 34.5 | 70,250 | Available |
| Thiruvananthapuram | 11:05 | FILLING FAST | 5 | 0 | 650.0-1200.0 | PVR LULU, Lulu International Shopping Mall, Tr | AUDI 01 | 340 | 116 | 34.1 | 99,810 | Available |
| Kochi | 19:00 | FILLING FAST | 5 | 0 | 750.0-950.0 | Cinepolis Centre Square Mall, Ernakulam, Kochi | IMAX | 229 | 75 | 32.8 | 66,000 | Available |
| Delhi-NCR | 22:50 | FILLING FAST | 3 | 0 | 1000.0-1370.0 | PVR Vegas, Dwarka, New Delhi | AUDI 03 | 410 | 134 | 32.7 | 153,200 | Available |
| Ranchi | 10:45 | FILLING FAST | 5 | 0 | 300.0-720.0 | PVR Nucleus Mall, Lalpur Circular Road, Ranchi | AUDI 02 | 265 | 83 | 31.3 | 33,520 | Available |
| Indore | 11:50 | FILLING FAST | 6 | 0 | 310.0-460.0 | INOX Phoenix Pride of India, Indore | SCREEN 1 | 354 | 110 | 31.1 | 41,170 | Available |
| Delhi-NCR | 20:15 | FILLING FAST | 2 | 0 | 2200.0-2400.0 | PVR Directors Cut, DLF Mall of India, Noida | AUDI 9 THE VENET | 87 | 26 | 29.9 | 61,600 | Available |
| Jaipur | 06:05 | FILLING FAST | 4 | 0 | 290.0-640.0 | Miraj Cinemas : Entertainment Paradise, Jaipur | SCREEN 3 | 470 | 133 | 28.3 | 51,320 | Available |
| Jaipur | 10:10 | FILLING FAST | 4 | 0 | 290.0-640.0 | Miraj Cinemas : Entertainment Paradise, Jaipur | SCREEN 3 | 470 | 133 | 28.3 | 52,320 | Available |
| Jaipur | 15:25 | FILLING FAST | 4 | 0 | 340.0-840.0 | Miraj Cinemas : Entertainment Paradise, Jaipur | SCREEN 1 | 478 | 127 | 26.6 | 60,630 | Available |
| Indore | 08:00 | FILLING FAST | 6 | 0 | 310.0-460.0 | INOX Phoenix Pride of India, Indore | SCREEN 1 | 299 | 79 | 26.4 | 32,460 | Available |
| Indore | 17:10 | FILLING FAST | 3 | 0 | 430.0-900.0 | PVR Treasure Island Mall, South Tukoganj, Indo | AUDI 7 PLAY HOUS | 80 | 21 | 26.2 | 12,240 | Available |
| Jaipur | 14:25 | FILLING FAST | 4 | 0 | 340.0-840.0 | Miraj Cinemas : Entertainment Paradise, Jaipur | SCREEN 3 | 470 | 123 | 26.2 | 60,870 | Available |
| Kochi | 11:00 | FILLING FAST | 5 | 0 | 750.0-950.0 | Cinepolis Centre Square Mall, Ernakulam, Kochi | IMAX | 229 | 56 | 24.5 | 49,450 | Available |
| Nashik | 07:00 | FILLING FAST | 3 | 0 | 250.0-480.0 | Cinemax City Center, City Center Mall, Nashik | SCREEN 3 | 202 | 48 | 23.8 | 17,100 | Available |
| Agra | 11:15 | FILLING FAST | 5 | 0 | 270.0-470.0 | PVR Anjana Mall, Agra | AUDI 4 | 123 | 29 | 23.6 | 10,760 | Available |
| Nashik | 17:55 | FILLING FAST | 3 | 0 | 390.0-580.0 | Cinemax City Center, City Center Mall, Nashik | SCREEN 2 | 202 | 46 | 22.8 | 23,320 | Available |
| Jammu | 09:50 | FILLING FAST | 5 | 0 | 330.0-670.0 | PVR KC, B.C Road, Jammu | AUDI 02 | 126 | 28 | 22.2 | 10,990 | Available |
| Ranchi | 09:45 | FILLING FAST | 4 | 0 | 300.0-400.0 | PVR Nucleus Mall, Lalpur Circular Road, Ranchi | AUDI 01 | 213 | 45 | 21.1 | 16,710 | Available |
| Dehradun | 11:15 | FILLING FAST | 6 | 0 | 300.0-630.0 | PVR Mall Of Dehradun | SCREEN 6 | 252 | 53 | 21.0 | 23,160 | Available |
| Ranchi | 13:50 | FILLING FAST | 4 | 0 | 370.0-440.0 | PVR Nucleus Mall, Lalpur Circular Road, Ranchi | AUDI 01 | 213 | 41 | 19.2 | 17,190 | Available |
| Ranchi | 17:55 | FILLING FAST | 4 | 0 | 400.0-460.0 | PVR Nucleus Mall, Lalpur Circular Road, Ranchi | AUDI 01 | 213 | 40 | 18.8 | 17,870 | Available |
| Jaipur | 09:15 | FILLING FAST | 5 | 0 | 310.0-580.0 | PVR Mall of Jaipur, Vaishali Nagar, Jaipur | AUDI 05 | 173 | 32 | 18.5 | 13,070 | Available |
| Nashik | 18:55 | FILLING FAST | 3 | 0 | 410.0-620.0 | Cinemax City Center, City Center Mall, Nashik | SCREEN 3 | 202 | 37 | 18.3 | 20,220 | Available |
| Ranchi | 22:00 | FILLING FAST | 4 | 0 | 400.0-460.0 | PVR Nucleus Mall, Lalpur Circular Road, Ranchi | AUDI 01 | 213 | 39 | 18.3 | 17,480 | Available |
| Bhubaneswar | 10:50 | FILLING FAST | 5 | 0 | 340.0-1000.0 | Cinepolis Nexus Esplanade, Rasulgarh, Bhubanes | AUDI 04 | 196 | 35 | 17.9 | 14,800 | Available |
| Chandigarh | 17:55 | FILLING FAST | 4 | 0 | 400.0-890.0 | PVR Elante Mall, Chandigarh | AUDI 7 | 179 | 31 | 17.3 | 20,230 | Available |
| Mumbai | 12:30 | FILLING FAST | 3 | 0 | 440.0-800.0 | Miraj Cinemas : R Mall, Mulund | SCREEN 3 | 293 | 50 | 17.1 | 25,380 | Available |
| Mumbai | 16:45 | FILLING FAST | 3 | 0 | 440.0-800.0 | Miraj Cinemas : R Mall, Mulund | SCREEN 3 | 293 | 50 | 17.1 | 25,380 | Available |
| Ranchi | 13:25 | FILLING FAST | 4 | 0 | 360.0-960.0 | PJP Cinemas, Mall of Ranchi, Ranchi | AUDI 3 | 189 | 32 | 16.9 | 16,970 | Available |
| Dehradun | 14:20 | FILLING FAST | 6 | 0 | 370.0-880.0 | PVR Mall Of Dehradun | SCREEN 3 | 137 | 23 | 16.8 | 13,470 | Available |
| Nashik | 08:00 | FILLING FAST | 3 | 0 | 250.0-440.0 | Cinemax City Center, City Center Mall, Nashik | SCREEN 5 | 191 | 32 | 16.8 | 10,480 | Available |
| Kanpur | 09:40 | FILLING FAST | 3 | 0 | 260.0-520.0 | PVR Deep, Saket Nagar, Kanpur | AUDI 01 | 191 | 31 | 16.2 | 10,620 | Available |
| Raipur | 15:05 | FILLING FAST | 4 | 0 | 400.0-690.0 | PVR Zora The Mall, Raipur | SCREEN 1 | 307 | 49 | 16.0 | 25,710 | Available |
| Agra | 15:20 | FILLING FAST | 5 | 0 | 340.0-540.0 | PVR Anjana Mall, Agra | AUDI 4 | 123 | 19 | 15.4 | 8,860 | Available |
| Thiruvananthapuram | 15:10 | FILLING FAST | 5 | 0 | 650.0-1200.0 | PVR LULU, Lulu International Shopping Mall, Tr | AUDI 01 | 243 | 37 | 15.2 | 34,000 | Available |
| Agra | 19:25 | FILLING FAST | 5 | 0 | 370.0-570.0 | PVR Anjana Mall, Agra | AUDI 4 | 113 | 17 | 15.0 | 8,360 | Available |
| Siliguri | 18:50 | FILLING FAST | 3 | 0 | 280.0-480.0 | INOX City Centre, Matigara, Siliguri | SCREEN 2 | 239 | 33 | 13.8 | 12,620 | Available |
| Ranchi | 09:30 | FILLING FAST | 4 | 0 | 280.0-630.0 | PJP Cinemas, Mall of Ranchi, Ranchi | AUDI 3 | 189 | 26 | 13.8 | 11,450 | Available |
| Raipur | 14:20 | FILLING FAST | 4 | 0 | 300.0-570.0 | PVR City Center, City Center Mall, Raipur | SCREEN 4 | 176 | 24 | 13.6 | 10,320 | Available |
| Raipur | 18:25 | FILLING FAST | 4 | 0 | 320.0-610.0 | PVR City Center, City Center Mall, Raipur | SCREEN 4 | 176 | 24 | 13.6 | 10,960 | Available |
| Goa | 19:00 | FILLING FAST | 5 | 0 | 440.0-910.0 | INOX Old GMC, DB Road, Goa | SCREEN 1 | 535 | 72 | 13.5 | 43,160 | Available |
| Chandigarh | 08:00 | FILLING FAST | 5 | 0 | 320.0-690.0 | PVR Elante Mall, Chandigarh | AUDI 3 | 254 | 34 | 13.4 | 15,060 | Available |
| Kochi | 23:00 | FILLING FAST | 5 | 0 | 750.0-950.0 | Cinepolis Centre Square Mall, Ernakulam, Kochi | IMAX | 229 | 30 | 13.1 | 26,500 | Available |
| Bhubaneswar | 12:15 | FILLING FAST | 5 | 0 | 360.0-1000.0 | Cinepolis Nexus Esplanade, Rasulgarh, Bhubanes | AUDI 05 | 131 | 17 | 13.0 | 6,980 | Available |
| Jaipur | 09:30 | FILLING FAST | 5 | 0 | 260.0-430.0 | INOX Pink Square Mall, Raja Park, Jaipur | SCREEN 2 | 226 | 28 | 12.4 | 9,170 | Available |
| Indore | 15:40 | FILLING FAST | 6 | 0 | 460.0-570.0 | INOX Phoenix Pride of India, Indore | SCREEN 1 | 299 | 36 | 12.0 | 19,910 | Available |
| Mumbai | 06:15 | FILLING FAST | 4 | 0 | 300.0-340.0 | Miraj Cinemas : Funfiesta, Nalasopara (W) | SCREEN 1 | 457 | 55 | 12.0 | 16,900 | Available |
| Indore | 19:40 | FILLING FAST | 6 | 0 | 450.0-940.0 | PVR Treasure Island Mall, South Tukoganj, Indo | AUDI 1 | 352 | 41 | 11.6 | 24,380 | Available |
| Mumbai | 08:45 | FILLING FAST | 4 | 0 | 280.0-540.0 | INOX R City, Ghatkopar (W), Mumbai | SCREEN 2 | 231 | 26 | 11.3 | 10,480 | Available |
| Mumbai | 12:50 | FILLING FAST | 4 | 0 | 500.0-1020.0 | INOX R City, Ghatkopar (W), Mumbai | SCREEN 2 | 231 | 26 | 11.3 | 18,800 | Available |
| Mumbai | 16:55 | FILLING FAST | 4 | 0 | 500.0-1020.0 | INOX R City, Ghatkopar (W), Mumbai | SCREEN 2 | 231 | 26 | 11.3 | 18,800 | Available |
| Bhubaneswar | 19:20 | FILLING FAST | 5 | 0 | 480.0-1250.0 | Cinepolis Nexus Esplanade, Rasulgarh, Bhubanes | AUDI 04 | 196 | 21 | 10.7 | 11,180 | Available |
| Bhubaneswar | 16:30 | FILLING FAST | 5 | 0 | 480.0-1250.0 | Cinepolis Nexus Esplanade, Rasulgarh, Bhubanes | AUDI 05 | 131 | 12 | 9.2 | 6,420 | Available |
| Ludhiana | 21:30 | FILLING FAST | 5 | 0 | 400.0-610.0 | PVR Pavilion Mall, Ludhiana | AUDI 3 | 154 | 14 | 9.1 | 7,010 | Available |
| Mumbai | 07:50 | FILLING FAST | 4 | 0 | 340.0-530.0 | PVR Market City, Kurla(W), Mumbai | AUDI 05 | 229 | 20 | 8.7 | 7,890 | Available |
| Bhubaneswar | 20:45 | FILLING FAST | 5 | 0 | 480.0-1250.0 | Cinepolis Nexus Esplanade, Rasulgarh, Bhubanes | AUDI 05 | 131 | 11 | 8.4 | 5,940 | Available |
| Nashik | 15:50 | FILLING FAST | 3 | 0 | 390.0-580.0 | Cinemax City Center, City Center Mall, Nashik | SCREEN 5 | 174 | 14 | 8.0 | 7,560 | Available |
| Kanpur | 13:45 | FILLING FAST | 3 | 0 | 360.0-620.0 | PVR Deep, Saket Nagar, Kanpur | AUDI 01 | 191 | 15 | 7.9 | 6,310 | Available |
| Siliguri | 17:10 | FILLING FAST | 3 | 0 | 320.0-460.0 | INOX ML Acropolis Mall, Siliguri | AUDI 4 | 256 | 20 | 7.8 | 8,480 | Available |
| Nashik | 23:59 | FILLING FAST | 3 | 0 | 410.0-620.0 | Cinemax City Center, City Center Mall, Nashik | SCREEN 5 | 174 | 12 | 6.9 | 7,120 | Available |
| Jaipur | 14:15 | FILLING FAST | 5 | 0 | 400.0-880.0 | Cinepolis Jewel of India, Jaipur | AUDI 4 | 165 | 11 | 6.7 | 7,400 | Available |
| Raipur | 23:15 | FILLING FAST | 4 | 0 | 400.0-690.0 | PVR Zora The Mall, Raipur | SCREEN 1 | 307 | 16 | 5.2 | 9,360 | Available |
| Vadodara | 19:10 | FILLING FAST | 4 | 0 | 340.0-570.0 | INOX Reliance Mega Mall, Old Padra Road, Vadod | SCREEN 3 | 228 | 10 | 4.4 | 3,800 | Available |
| Pune | 11:40 | FILLING FAST | 5 | 0 | 360.0-620.0 | PVR Kumar Pacific Mall, Swar Gate, Pune | AUDI 03 | 207 | 9 | 4.3 | 4,680 | Available |
| Ranchi | 23:00 | FILLING FAST | 5 | 0 | 400.0-720.0 | PVR Nucleus Mall, Lalpur Circular Road, Ranchi | AUDI 02 | 220 | 7 | 3.2 | 5,040 | Available |
| Jalandhar | 16:40 | FILLING FAST | 7 | 0 | 380.0-710.0 | PVR MBD Neopolis Mall, Sehdev Market, Jalandha | AUDI 01 | 176 | 5 | 2.8 | 3,290 | Available |
| Lucknow | 13:50 | FILLING FAST | 4 | 0 | 450.0-850.0 | PVR SUPERPLEX Lulu, Lulu Mall, Lucknow | AUDI 02 | 254 | 6 | 2.4 | 3,500 | Available |
| Indore | 08:10 | FILLING FAST | 6 | 0 | 280.0-580.0 | PVR Treasure Island Mall, South Tukoganj, Indo | AUDI 1 | 291 | 5 | 1.7 | 1,550 | Available |
| Amritsar | 14:35 | FILLING FAST | 6 | 0 | 330.0-630.0 | PVR SCT City Centre, City Centre, Amritsar | AUDI 1 | 197 | 3 | 1.5 | 1,890 | Available |
| Siliguri | 10:40 | FILLING FAST | 3 | 0 | 280.0-440.0 | INOX City Centre, Matigara, Siliguri | SCREEN 2 | 218 | 3 | 1.4 | 1,320 | Available |
| Indore | 08:25 | FILLING FAST | 6 | 0 | 280.0-580.0 | INOX C-21 Mall, Sheetal Nagar, Indore | SCREEN 4 | 254 | 2 | 0.8 | 1,160 | Available |
| Indore | 12:00 | FILLING FAST | 6 | 0 | 430.0-900.0 | PVR Treasure Island Mall, South Tukoganj, Indo | AUDI 1 | 291 | 0 | 0.0 | 0 | Available |
| Indore | 23:30 | FILLING FAST | 6 | 0 | 450.0-940.0 | PVR Treasure Island Mall, South Tukoganj, Indo | AUDI 1 | 291 | 0 | 0.0 | 0 | Available |
| Bengaluru | 17:00 | AVAILABLE | 2 | 0 | 200.0-250.0 | KRG Soundarya Mahal A/C 4K Dolby Atmos, Doddab | SOUNDARYA | 527 | 426 | 80.8 | 90,100 | Filling Fast |
| Bengaluru | 20:30 | AVAILABLE | 2 | 0 | 200.0-250.0 | KRG Soundarya Mahal A/C 4K Dolby Atmos, Doddab | SOUNDARYA | 527 | 424 | 80.5 | 89,650 | Filling Fast |
| Bengaluru | 13:30 | AVAILABLE | 2 | 0 | 200.0-250.0 | KRG Soundarya Mahal A/C 4K Dolby Atmos, Doddab | SOUNDARYA | 527 | 421 | 79.9 | 88,950 | Filling Fast |
| Jaipur | 10:15 | AVAILABLE | 1 | 0 | 790.0-790.0 | PVR Mall of Jaipur, Vaishali Nagar, Jaipur | AUDI 01 | 38 | 15 | 39.5 | 11,850 | Available |
| Jaipur | 22:55 | AVAILABLE | 4 | 0 | 370.0-890.0 | Miraj Cinemas : Entertainment Paradise, Jaipur | SCREEN 3 | 470 | 118 | 25.1 | 59,450 | Available |
| Indore | 06:40 | AVAILABLE | 6 | 0 | 280.0-580.0 | PVR Treasure Island Mall, South Tukoganj, Indo | AUDI 3 | 297 | 70 | 23.6 | 22,970 | Available |
| Pune | 19:20 | AVAILABLE | 7 | 0 | 1400.0-2920.0 | Cinepolis Nexus Westend, Aundh, Pune | IMAX | 282 | 64 | 22.7 | 94,560 | Available |
| Jamshedpur | 09:00 | AVAILABLE | 3 | 0 | 300.0-340.0 | PJP Cinepolis City Centre Mall, Mauja, Jamshed | SCREEN 3 | 114 | 22 | 19.3 | 7,420 | Available |
| Dehradun | 21:00 | AVAILABLE | 2 | 0 | 460.0-500.0 | PVR Pacific Mall, Main Rajpur Road, Dehradun | AUDI 04 | 96 | 18 | 18.8 | 9,000 | Available |
| Jaipur | 22:30 | AVAILABLE | 1 | 0 | 1070.0-1070.0 | PVR Mall of Jaipur, Vaishali Nagar, Jaipur | AUDI 01 | 38 | 7 | 18.4 | 7,490 | Available |
| Nashik | 09:45 | AVAILABLE | 3 | 0 | 250.0-440.0 | Cinemax City Center, City Center Mall, Nashik | SCREEN 2 | 185 | 34 | 18.4 | 11,720 | Available |
| Indore | 15:10 | AVAILABLE | 2 | 0 | 1010.0-1040.0 | INOX Phoenix Pride of India, Indore | INSIGNIA 8 | 44 | 8 | 18.2 | 8,320 | Available |
| Ranchi | 11:25 | AVAILABLE | 3 | 0 | 280.0-350.0 | PJP Cinemas, Mall of Ranchi, Ranchi | AUDI 2 | 210 | 38 | 18.1 | 13,300 | Available |
| Dehradun | 15:20 | AVAILABLE | 6 | 0 | 370.0-810.0 | PVR Mall Of Dehradun | SCREEN 6 | 252 | 44 | 17.5 | 23,200 | Available |
| Raipur | 11:00 | AVAILABLE | 4 | 0 | 300.0-690.0 | PVR Zora The Mall, Raipur | SCREEN 1 | 300 | 51 | 17.0 | 20,010 | Available |
| Pune | 19:15 | AVAILABLE | 3 | 0 | 350.0-740.0 | Miraj Cinemas : Spine City Mall, Pune | SCREEN 4 | 220 | 37 | 16.8 | 15,480 | Available |
| Jammu | 21:20 | AVAILABLE | 5 | 0 | 410.0-720.0 | PVR KC, B.C Road, Jammu | AUDI 02 | 126 | 21 | 16.7 | 9,990 | Available |
| Patna | 09:00 | AVAILABLE | 5 | 0 | 250.0-600.0 | Cinepolis P&M Mall, Patliputra Colony, Patna | SCREEN 4 | 180 | 29 | 16.1 | 10,610 | Available |
| Bhubaneswar | 09:00 | AVAILABLE | 4 | 0 | 320.0-1000.0 | Cinepolis Nexus Esplanade, Rasulgarh, Bhubanes | AUDI 01 | 132 | 21 | 15.9 | 7,560 | Available |
| Pune | 10:50 | AVAILABLE | 7 | 0 | 1200.0-2520.0 | Cinepolis Nexus Westend, Aundh, Pune | IMAX | 282 | 44 | 15.6 | 56,340 | Available |
| Pune | 15:00 | AVAILABLE | 3 | 0 | 350.0-740.0 | Miraj Cinemas : Spine City Mall, Pune | SCREEN 4 | 220 | 34 | 15.5 | 13,260 | Available |
| Siliguri | 18:10 | AVAILABLE | 3 | 0 | 320.0-460.0 | INOX ML Acropolis Mall, Siliguri | AUDI 1 | 223 | 34 | 15.2 | 15,400 | Available |
| Jamshedpur | 08:00 | AVAILABLE | 4 | 0 | 300.0-700.0 | PJP Cinepolis City Centre Mall, Mauja, Jamshed | SCREEN 5 | 263 | 40 | 15.2 | 14,920 | Available |
| Jamshedpur | 10:50 | AVAILABLE | 4 | 0 | 300.0-700.0 | PJP Cinepolis City Centre Mall, Mauja, Jamshed | SCREEN 1 | 206 | 31 | 15.0 | 10,360 | Available |
| Mumbai | 08:15 | AVAILABLE | 3 | 0 | 340.0-700.0 | Miraj Cinemas : R Mall, Mulund | SCREEN 3 | 293 | 44 | 15.0 | 16,280 | Available |
| Kochi | 15:00 | AVAILABLE | 5 | 0 | 750.0-950.0 | Cinepolis Centre Square Mall, Ernakulam, Kochi | IMAX | 229 | 34 | 14.8 | 29,750 | Available |
| Agra | 17:45 | AVAILABLE | 5 | 0 | 370.0-570.0 | PVR Anjana Mall, Agra | AUDI 2 | 130 | 19 | 14.6 | 9,630 | Available |
| Pune | 14:00 | AVAILABLE | 3 | 0 | 350.0-740.0 | Miraj Cinemas : Spine City Mall, Pune | SCREEN 3 | 241 | 34 | 14.1 | 13,260 | Available |
| Kanpur | 17:50 | AVAILABLE | 3 | 0 | 360.0-620.0 | PVR Deep, Saket Nagar, Kanpur | AUDI 01 | 206 | 28 | 13.6 | 10,830 | Available |
| Agra | 13:40 | AVAILABLE | 5 | 0 | 340.0-540.0 | PVR Anjana Mall, Agra | AUDI 2 | 120 | 16 | 13.3 | 6,810 | Available |
| Pune | 18:15 | AVAILABLE | 3 | 0 | 350.0-740.0 | Miraj Cinemas : Spine City Mall, Pune | SCREEN 3 | 241 | 32 | 13.3 | 12,480 | Available |
| Jamshedpur | 19:20 | AVAILABLE | 4 | 0 | 340.0-800.0 | PJP Cinepolis City Centre Mall, Mauja, Jamshed | SCREEN 1 | 206 | 27 | 13.1 | 10,160 | Available |
| Lucknow | 11:00 | AVAILABLE | 3 | 0 | 400.0-600.0 | PVR Phoenix United Mall, Alambagh, Lucknow | AUDI 02 | 432 | 55 | 12.7 | 23,000 | Available |
| Dehradun | 09:15 | AVAILABLE | 6 | 0 | 300.0-680.0 | PVR Mall Of Dehradun | SCREEN 1 | 144 | 18 | 12.5 | 7,740 | Available |
| Indore | 19:00 | AVAILABLE | 2 | 0 | 1110.0-1140.0 | INOX Phoenix Pride of India, Indore | INSIGNIA 8 | 40 | 5 | 12.5 | 5,700 | Available |
| Indore | 19:30 | AVAILABLE | 6 | 0 | 480.0-580.0 | INOX Phoenix Pride of India, Indore | SCREEN 1 | 299 | 37 | 12.4 | 20,370 | Available |
| Thiruvananthapuram | 23:20 | AVAILABLE | 5 | 0 | 650.0-850.0 | PVR LULU, Lulu International Shopping Mall, Tr | AUDI 01 | 243 | 30 | 12.3 | 22,950 | Available |
| Jamshedpur | 12:15 | AVAILABLE | 4 | 0 | 320.0-700.0 | PJP Cinepolis City Centre Mall, Mauja, Jamshed | SCREEN 5 | 263 | 32 | 12.2 | 13,520 | Available |
| Ahmedabad | 20:45 | AVAILABLE | 5 | 0 | 380.0-500.0 | Cinepolis Nexus One, Ahmedabad | AUDI 6 | 126 | 15 | 11.9 | 7,340 | Available |
| Indore | 14:35 | AVAILABLE | 2 | 0 | 810.0-810.0 | INOX Nexus Indore Central, Regal Square, Indor | INSIGNIA 6 | 42 | 5 | 11.9 | 4,050 | Available |
| Patna | 13:15 | AVAILABLE | 5 | 0 | 350.0-690.0 | Cinepolis P&M Mall, Patliputra Colony, Patna | SCREEN 4 | 180 | 21 | 11.7 | 9,620 | Available |
| Vadodara | 10:50 | AVAILABLE | 3 | 0 | 230.0-270.0 | Cinepolis Inorbit Mall, Gorwa, Vadodara | AUDI 1 | 146 | 17 | 11.6 | 4,590 | Available |
| Bhubaneswar | 12:50 | AVAILABLE | 4 | 0 | 380.0-1050.0 | Cinepolis Nexus Esplanade, Rasulgarh, Bhubanes | AUDI 01 | 132 | 15 | 11.4 | 6,300 | Available |
| Mumbai | 21:00 | AVAILABLE | 4 | 0 | 520.0-1060.0 | INOX R City, Ghatkopar (W), Mumbai | SCREEN 2 | 231 | 26 | 11.3 | 19,520 | Available |
| Surat | 15:50 | AVAILABLE | 4 | 0 | 380.0-640.0 | INOX VR Surat, Dumas Road, Surat | SCREEN 5 | 214 | 24 | 11.2 | 9,520 | Available |
| Surat | 19:55 | AVAILABLE | 4 | 0 | 400.0-680.0 | INOX VR Surat, Dumas Road, Surat | SCREEN 5 | 214 | 24 | 11.2 | 10,000 | Available |
| Surat | 23:59 | AVAILABLE | 4 | 0 | 400.0-680.0 | INOX VR Surat, Dumas Road, Surat | SCREEN 5 | 214 | 24 | 11.2 | 10,000 | Available |
| Amritsar | 14:15 | AVAILABLE | 5 | 0 | 330.0-800.0 | Cinepolis Nexus, Sultan Wind Sub Urban Main GT | AUDI 4 | 135 | 15 | 11.1 | 6,400 | Available |
| Guwahati | 15:05 | AVAILABLE | 5 | 0 | 330.0-960.0 | Cinepolis Central Mall, Christian Basti, Guwah | AUDI 1 | 209 | 22 | 10.5 | 8,960 | Available |
| Mumbai | 18:10 | AVAILABLE | 2 | 0 | 1850.0-1950.0 | INOX Megaplex, Oberoi Sky City Mall, Mumbai | SCREEN 1 | 38 | 4 | 10.5 | 7,500 | Available |
| Ranchi | 19:25 | AVAILABLE | 3 | 0 | 360.0-410.0 | PJP Cinemas, Mall of Ranchi, Ranchi | AUDI 2 | 210 | 22 | 10.5 | 9,020 | Available |
| Kolkata | 17:50 | AVAILABLE | 1 | 0 | 1920.0-1920.0 | INOX Quest Mall, Ballygunge, Kolkata | SCREEN 5 | 77 | 8 | 10.4 | 15,360 | Available |
| Kanpur | 10:20 | AVAILABLE | 4 | 0 | 340.0-810.0 | INOX Z Square Mall, Bada Chauraha, Kanpur | SCREEN 1 | 280 | 29 | 10.4 | 10,700 | Available |
| Delhi-NCR | 09:10 | AVAILABLE | 1 | 0 | 840.0-840.0 | Miraj Cinemas : ATS Khyber Range Mall, Ghaziab | SCREEN4 | 49 | 5 | 10.2 | 4,200 | Available |
| Ranchi | 15:25 | AVAILABLE | 3 | 0 | 360.0-410.0 | PJP Cinemas, Mall of Ranchi, Ranchi | AUDI 2 | 210 | 21 | 10.0 | 8,610 | Available |
| Chandigarh | 10:45 | AVAILABLE | 5 | 0 | 320.0-690.0 | PVR Elante Mall, Chandigarh | AUDI 6 | 312 | 31 | 9.9 | 12,640 | Available |
| Pune | 21:25 | AVAILABLE | 3 | 0 | 450.0-490.0 | Cinepolis Seasons Mall, Hadapsar, Pune | AUDI 05 | 153 | 15 | 9.8 | 7,350 | Available |
| Nashik | 14:50 | AVAILABLE | 3 | 0 | 390.0-580.0 | Cinemax City Center, City Center Mall, Nashik | SCREEN 3 | 185 | 18 | 9.7 | 10,160 | Available |
| Amritsar | 10:00 | AVAILABLE | 5 | 0 | 280.0-650.0 | Cinepolis Nexus, Sultan Wind Sub Urban Main GT | AUDI 4 | 135 | 13 | 9.6 | 4,420 | Available |
| Raipur | 13:05 | AVAILABLE | 4 | 0 | 350.0-690.0 | PVR Zora The Mall, Raipur | SCREEN 5 | 168 | 16 | 9.5 | 8,140 | Available |
| Surat | 09:45 | AVAILABLE | 5 | 0 | 290.0-490.0 | INOX VR Surat, Dumas Road, Surat | SCREEN 8 | 302 | 28 | 9.3 | 8,560 | Available |
| Surat | 13:50 | AVAILABLE | 5 | 0 | 380.0-640.0 | INOX VR Surat, Dumas Road, Surat | SCREEN 8 | 302 | 28 | 9.3 | 11,080 | Available |
| Surat | 17:55 | AVAILABLE | 5 | 0 | 380.0-640.0 | INOX VR Surat, Dumas Road, Surat | SCREEN 8 | 302 | 28 | 9.3 | 11,080 | Available |
| Agra | 09:35 | AVAILABLE | 5 | 0 | 270.0-470.0 | PVR Anjana Mall, Agra | AUDI 2 | 120 | 11 | 9.2 | 3,380 | Available |
| Indore | 17:55 | AVAILABLE | 2 | 0 | 1010.0-1040.0 | INOX C-21 Mall, Sheetal Nagar, Indore | INSIGNIA 9 | 44 | 4 | 9.1 | 4,160 | Available |
| Kolkata | 21:55 | AVAILABLE | 1 | 0 | 1920.0-1920.0 | INOX Quest Mall, Ballygunge, Kolkata | SCREEN 5 | 77 | 7 | 9.1 | 13,440 | Available |
| Dehradun | 21:30 | AVAILABLE | 6 | 0 | 390.0-800.0 | PVR Mall Of Dehradun | SCREEN 1 | 122 | 11 | 9.0 | 5,280 | Available |
| Surat | 07:00 | AVAILABLE | 5 | 0 | 290.0-490.0 | INOX VR Surat, Dumas Road, Surat | SCREEN 6 | 272 | 24 | 8.8 | 7,360 | Available |
| Surat | 12:50 | AVAILABLE | 5 | 0 | 380.0-640.0 | INOX VR Surat, Dumas Road, Surat | SCREEN 7 | 272 | 24 | 8.8 | 9,520 | Available |
| Surat | 14:50 | AVAILABLE | 5 | 0 | 380.0-640.0 | INOX VR Surat, Dumas Road, Surat | SCREEN 6 | 272 | 24 | 8.8 | 9,520 | Available |
| Surat | 16:55 | AVAILABLE | 5 | 0 | 380.0-640.0 | INOX VR Surat, Dumas Road, Surat | SCREEN 7 | 272 | 24 | 8.8 | 9,520 | Available |
| Surat | 18:55 | AVAILABLE | 5 | 0 | 400.0-680.0 | INOX VR Surat, Dumas Road, Surat | SCREEN 6 | 272 | 24 | 8.8 | 10,000 | Available |
| Jamshedpur | 15:05 | AVAILABLE | 4 | 0 | 320.0-700.0 | PJP Cinepolis City Centre Mall, Mauja, Jamshed | SCREEN 1 | 206 | 18 | 8.7 | 7,160 | Available |
| Dehradun | 19:15 | AVAILABLE | 4 | 0 | 440.0-940.0 | PVR Centrio, Unison Mall, Dehradun | AUDI 05 | 195 | 16 | 8.2 | 9,850 | Available |
| Delhi-NCR | 10:10 | AVAILABLE | 2 | 0 | 280.0-300.0 | Miraj Cinemas : ATS Khyber Range Mall, Ghaziab | SCREEN1 | 110 | 9 | 8.2 | 2,700 | Available |
| Ranchi | 23:25 | AVAILABLE | 3 | 0 | 360.0-410.0 | PJP Cinemas, Mall of Ranchi, Ranchi | AUDI 2 | 210 | 17 | 8.1 | 6,970 | Available |
| Chandigarh | 21:50 | AVAILABLE | 2 | 0 | 250.0-270.0 | Cinepolis TDI, Jagat Mall, Chandigarh | SCREEN 1 | 223 | 18 | 8.1 | 4,860 | Available |
| Siliguri | 14:05 | AVAILABLE | 3 | 0 | 320.0-460.0 | INOX ML Acropolis Mall, Siliguri | AUDI 1 | 223 | 18 | 8.1 | 7,680 | Available |
| Jaipur | 11:15 | AVAILABLE | 5 | 0 | 280.0-550.0 | PVR Mall of Jaipur, Vaishali Nagar, Jaipur | AUDI 04 | 162 | 13 | 8.0 | 4,670 | Available |
| Lucknow | 14:20 | AVAILABLE | 4 | 0 | 450.0-750.0 | INOX Megaplex Emerald, Ashiyana, Lucknow | SCREEN 3 | 262 | 21 | 8.0 | 9,450 | Available |
| Jamshedpur | 20:45 | AVAILABLE | 4 | 0 | 340.0-800.0 | PJP Cinepolis City Centre Mall, Mauja, Jamshed | SCREEN 5 | 263 | 21 | 8.0 | 11,320 | Available |
| Jaipur | 14:20 | AVAILABLE | 1 | 0 | 920.0-920.0 | PVR Mall of Jaipur, Vaishali Nagar, Jaipur | AUDI 01 | 38 | 3 | 7.9 | 2,760 | Available |
| Jamshedpur | 13:15 | AVAILABLE | 3 | 0 | 320.0-360.0 | PJP Cinepolis City Centre Mall, Mauja, Jamshed | SCREEN 3 | 114 | 9 | 7.9 | 3,240 | Available |
| Pune | 20:25 | AVAILABLE | 4 | 0 | 400.0-490.0 | Cinepolis Seasons Mall, Hadapsar, Pune | AUDI 02 | 241 | 19 | 7.9 | 9,270 | Available |
| Patna | 21:45 | AVAILABLE | 5 | 0 | 400.0-720.0 | Cinepolis P&M Mall, Patliputra Colony, Patna | SCREEN 4 | 180 | 14 | 7.8 | 6,720 | Available |
| Vadodara | 13:15 | AVAILABLE | 3 | 0 | 350.0-390.0 | Cinepolis Inorbit Mall, Gorwa, Vadodara | AUDI 2 | 182 | 14 | 7.7 | 5,460 | Available |
| Amritsar | 18:25 | AVAILABLE | 4 | 0 | 360.0-410.0 | INOX VR Ambarsar, Circular Road, Amritsar | SCREEN 4 | 308 | 23 | 7.5 | 9,230 | Available |
| Amritsar | 18:30 | AVAILABLE | 5 | 0 | 330.0-800.0 | Cinepolis Nexus, Sultan Wind Sub Urban Main GT | AUDI 4 | 135 | 10 | 7.4 | 4,200 | Available |
| Goa | 11:00 | AVAILABLE | 5 | 0 | 420.0-790.0 | INOX Old GMC, DB Road, Goa | SCREEN 1 | 465 | 34 | 7.3 | 19,740 | Available |
| Chandigarh | 13:50 | AVAILABLE | 4 | 0 | 400.0-890.0 | PVR Elante Mall, Chandigarh | AUDI 7 | 179 | 13 | 7.3 | 8,350 | Available |
| Dehradun | 19:25 | AVAILABLE | 6 | 0 | 390.0-850.0 | PVR Mall Of Dehradun | SCREEN 6 | 226 | 16 | 7.1 | 10,270 | Available |
| Dehradun | 10:05 | AVAILABLE | 3 | 0 | 350.0-670.0 | PVR Pacific Mall, Main Rajpur Road, Dehradun | AUDI 01 NEW | 170 | 12 | 7.1 | 5,140 | Available |
| Kanpur | 14:00 | AVAILABLE | 3 | 0 | 290.0-390.0 | Miraj Cinemas : Gurudev Pammi, Kanpur | PAMMI | 201 | 14 | 7.0 | 5,360 | Available |
| Bhubaneswar | 17:05 | AVAILABLE | 4 | 0 | 480.0-1250.0 | Cinepolis Nexus Esplanade, Rasulgarh, Bhubanes | AUDI 01 | 132 | 9 | 6.8 | 4,680 | Available |
| Bhubaneswar | 21:20 | AVAILABLE | 4 | 0 | 480.0-1250.0 | Cinepolis Nexus Esplanade, Rasulgarh, Bhubanes | AUDI 01 | 132 | 9 | 6.8 | 6,870 | Available |
| Pune | 23:35 | AVAILABLE | 7 | 0 | 1350.0-2820.0 | Cinepolis Nexus Westend, Aundh, Pune | IMAX | 282 | 19 | 6.7 | 27,250 | Available |
| Indore | 18:30 | AVAILABLE | 5 | 0 | 450.0-940.0 | INOX Phoenix Pride of India, Indore | SCREEN 4 | 179 | 12 | 6.7 | 5,760 | Available |
| Ludhiana | 19:20 | AVAILABLE | 6 | 0 | 390.0-900.0 | Cinepolis Nexus MBD, Ludhiana | AUDI 4 | 330 | 22 | 6.7 | 13,050 | Available |
| Dehradun | 13:20 | AVAILABLE | 6 | 0 | 370.0-760.0 | PVR Mall Of Dehradun | SCREEN 1 | 122 | 8 | 6.6 | 3,840 | Available |
| Pune | 15:35 | AVAILABLE | 3 | 0 | 500.0-560.0 | Cinepolis Nexus Westend, Aundh, Pune | AUDI07 | 127 | 8 | 6.3 | 4,480 | Available |
| Kanpur | 22:00 | AVAILABLE | 3 | 0 | 300.0-400.0 | Miraj Cinemas : Gurudev Pammi, Kanpur | PAMMI | 201 | 12 | 6.0 | 4,800 | Available |
| Siliguri | 21:15 | AVAILABLE | 3 | 0 | 320.0-460.0 | INOX ML Acropolis Mall, Siliguri | AUDI 4 | 256 | 15 | 5.9 | 6,660 | Available |
| Jaipur | 15:15 | AVAILABLE | 5 | 0 | 400.0-880.0 | Cinepolis Jewel of India, Jaipur | AUDI 2 | 241 | 14 | 5.8 | 8,360 | Available |
| Jaipur | 11:30 | AVAILABLE | 4 | 0 | 300.0-330.0 | INOX GT Central Mall, Malviya Nagar, Jaipur | SCREEN 2 | 259 | 15 | 5.8 | 4,890 | Available |
| Guwahati | 19:20 | AVAILABLE | 5 | 0 | 330.0-960.0 | Cinepolis Central Mall, Christian Basti, Guwah | AUDI 1 | 209 | 12 | 5.7 | 4,840 | Available |
| Dehradun | 17:25 | AVAILABLE | 6 | 0 | 370.0-760.0 | PVR Mall Of Dehradun | SCREEN 1 | 122 | 7 | 5.7 | 3,360 | Available |
| Delhi-NCR | 12:40 | AVAILABLE | 3 | 0 | 2400.0-2400.0 | Gurugram: PVR Directors Cut Ambience Mall | AUDI 09 DC | 53 | 3 | 5.7 | 7,200 | Available |
| Bhubaneswar | 15:05 | AVAILABLE | 5 | 0 | 460.0-1200.0 | Cinepolis Nexus Esplanade, Rasulgarh, Bhubanes | AUDI 04 | 196 | 11 | 5.6 | 5,620 | Available |
| Ahmedabad | 16:30 | AVAILABLE | 5 | 0 | 340.0-480.0 | Cinepolis Nexus One, Ahmedabad | AUDI 6 | 126 | 7 | 5.6 | 3,360 | Available |
| Kolkata | 17:30 | AVAILABLE | 3 | 0 | 400.0-440.0 | Cinepolis Acropolis Mall, Rajdanga Road, Kolka | AUDI04 | 252 | 14 | 5.6 | 6,080 | Available |
| Surat | 10:50 | AVAILABLE | 3 | 0 | 280.0-300.0 | Cinepolis Imperial Square Mall, Adajan, Surat | AUDI 1 | 144 | 8 | 5.6 | 2,400 | Available |
| Surat | 19:20 | AVAILABLE | 3 | 0 | 380.0-400.0 | Cinepolis Imperial Square Mall, Adajan, Surat | AUDI 1 | 144 | 8 | 5.6 | 3,200 | Available |
| Surat | 23:35 | AVAILABLE | 3 | 0 | 380.0-400.0 | Cinepolis Imperial Square Mall, Adajan, Surat | AUDI 1 | 144 | 8 | 5.6 | 3,200 | Available |
| Rajkot | 07:00 | AVAILABLE | 6 | 0 | 300.0-380.0 | Cinepolis Vandana, Gondal Road, Rajkot | AUDI 2 | 199 | 11 | 5.5 | 3,920 | Available |
| Pune | 11:20 | AVAILABLE | 3 | 0 | 480.0-540.0 | Cinepolis Nexus Westend, Aundh, Pune | AUDI07 | 127 | 7 | 5.5 | 3,760 | Available |
| Lucknow | 11:30 | AVAILABLE | 4 | 0 | 400.0-620.0 | INOX Megaplex Phoenix Palassio Mall, Amar Sahe | SCREEN 7 | 203 | 11 | 5.4 | 4,400 | Available |
| Pune | 12:00 | AVAILABLE | 4 | 0 | 320.0-380.0 | Cinepolis Seasons Mall, Hadapsar, Pune | AUDI 02 | 241 | 13 | 5.4 | 4,880 | Available |
| Pune | 21:45 | AVAILABLE | 5 | 0 | 500.0-600.0 | Cinepolis Nexus Westend, Aundh, Pune | AUDI03 | 261 | 14 | 5.4 | 8,200 | Available |
| Mumbai | 10:00 | AVAILABLE | 2 | 0 | 750.0-840.0 | INOX Megaplex, Oberoi Sky City Mall, Mumbai | SCREEN 1 | 38 | 2 | 5.3 | 1,500 | Available |
| Bhopal | 15:45 | AVAILABLE | 4 | 0 | 330.0-800.0 | PVR Aura Mall, Shahpura, Bhopal | SCREEN2 | 308 | 16 | 5.2 | 8,700 | Available |
| Ludhiana | 10:50 | AVAILABLE | 6 | 0 | 320.0-700.0 | Cinepolis Nexus MBD, Ludhiana | AUDI 4 | 330 | 17 | 5.2 | 6,500 | Available |
| Bhopal | 20:45 | AVAILABLE | 4 | 0 | 350.0-430.0 | Cinepolis Aashima Mall, Bawadiya Kalan, Bhopal | AUDI04 | 215 | 11 | 5.1 | 4,510 | Available |
| Bhubaneswar | 23:35 | AVAILABLE | 5 | 0 | 480.0-1250.0 | Cinepolis Nexus Esplanade, Rasulgarh, Bhubanes | AUDI 04 | 196 | 10 | 5.1 | 5,360 | Available |
| Chandigarh | 09:45 | AVAILABLE | 4 | 0 | 320.0-690.0 | PVR Elante Mall, Chandigarh | AUDI 7 | 179 | 9 | 5.0 | 5,860 | Available |
| Chandigarh | 22:00 | AVAILABLE | 4 | 0 | 420.0-930.0 | PVR Elante Mall, Chandigarh | AUDI 7 | 179 | 9 | 5.0 | 8,370 | Available |
| Ludhiana | 21:45 | AVAILABLE | 6 | 0 | 390.0-900.0 | Cinepolis Nexus MBD, Ludhiana | AUDI 1 | 398 | 20 | 5.0 | 11,250 | Available |
| Agra | 21:50 | AVAILABLE | 5 | 0 | 370.0-570.0 | PVR Anjana Mall, Agra | AUDI 2 | 120 | 6 | 5.0 | 2,780 | Available |
| Indore | 07:30 | AVAILABLE | 2 | 0 | 690.0-720.0 | INOX Phoenix Pride of India, Indore | INSIGNIA 8 | 40 | 2 | 5.0 | 1,440 | Available |
| Indore | 22:50 | AVAILABLE | 2 | 0 | 1150.0-1180.0 | INOX Phoenix Pride of India, Indore | INSIGNIA 8 | 40 | 2 | 5.0 | 2,360 | Available |
| Pune | 19:40 | AVAILABLE | 4 | 0 | 400.0-490.0 | Cinepolis Seasons Mall, Hadapsar, Pune | AUDI 01 | 261 | 13 | 5.0 | 6,290 | Available |
| Jaipur | 15:20 | AVAILABLE | 5 | 0 | 400.0-730.0 | PVR Mall of Jaipur, Vaishali Nagar, Jaipur | AUDI 04 | 162 | 8 | 4.9 | 3,360 | Available |
| Ahmedabad | 12:15 | AVAILABLE | 5 | 0 | 340.0-480.0 | Cinepolis Nexus One, Ahmedabad | AUDI 6 | 126 | 6 | 4.8 | 2,880 | Available |
| Kolkata | 09:00 | AVAILABLE | 3 | 0 | 300.0-340.0 | Cinepolis Acropolis Mall, Rajdanga Road, Kolka | AUDI04 | 252 | 12 | 4.8 | 3,980 | Available |
| Bhopal | 12:15 | AVAILABLE | 4 | 0 | 330.0-410.0 | Cinepolis Aashima Mall, Bawadiya Kalan, Bhopal | AUDI04 | 215 | 10 | 4.7 | 3,900 | Available |
| Nagpur | 11:40 | AVAILABLE | 4 | 0 | 280.0-310.0 | INOX Jaswant Tuli Mall, Kamptee Road, Nagpur | SCREEN 2 | 305 | 14 | 4.6 | 4,180 | Available |
| Delhi-NCR | 11:55 | AVAILABLE | 1 | 0 | 540.0-540.0 | Miraj Cinemas : India Expo Plaza, Greater Noid | SCREEN3 | 22 | 1 | 4.5 | 540 | Available |
| Indore | 10:15 | AVAILABLE | 2 | 0 | 690.0-720.0 | INOX C-21 Mall, Sheetal Nagar, Indore | INSIGNIA 9 | 44 | 2 | 4.5 | 1,440 | Available |
| Jaipur | 22:15 | AVAILABLE | 4 | 0 | 440.0-480.0 | INOX GT Central Mall, Malviya Nagar, Jaipur | SCREEN 1 | 220 | 10 | 4.5 | 4,800 | Available |
| Surat | 19:40 | AVAILABLE | 4 | 0 | 460.0-750.0 | PVR Rahul Raj Mall, Dumas Road, Surat | AUDI 08 | 154 | 7 | 4.5 | 3,510 | Available |
| Lucknow | 18:00 | AVAILABLE | 4 | 0 | 370.0-850.0 | Cinepolis One Awadh Center Mall, Gomti Nagar,  | SCREEN 1 | 199 | 9 | 4.5 | 3,330 | Available |
| Rajkot | 19:30 | AVAILABLE | 6 | 0 | 360.0-480.0 | Cinepolis Vandana, Gondal Road, Rajkot | AUDI 2 | 199 | 9 | 4.5 | 4,100 | Available |
| Raipur | 13:55 | AVAILABLE | 5 | 0 | 350.0-620.0 | PVR Magneto The Mall, Magneto Mall, Raipur | AUDI 03 | 225 | 10 | 4.4 | 4,840 | Available |
| Vadodara | 17:30 | AVAILABLE | 3 | 0 | 400.0-400.0 | Cinepolis Inorbit Mall, Gorwa, Vadodara | AUDI 2 | 182 | 8 | 4.4 | 3,200 | Available |
| Guwahati | 10:50 | AVAILABLE | 5 | 0 | 280.0-680.0 | Cinepolis Central Mall, Christian Basti, Guwah | AUDI 1 | 209 | 9 | 4.3 | 2,840 | Available |
| Guwahati | 17:30 | AVAILABLE | 5 | 0 | 330.0-960.0 | Cinepolis Central Mall, Christian Basti, Guwah | AUDI 2 | 209 | 9 | 4.3 | 3,690 | Available |
| Lucknow | 21:30 | AVAILABLE | 3 | 0 | 450.0-450.0 | INOX Megaplex Emerald, Ashiyana, Lucknow | SCREEN 4 | 164 | 7 | 4.3 | 3,150 | Available |
| Dehradun | 12:50 | AVAILABLE | 2 | 0 | 430.0-470.0 | PVR Pacific Mall, Main Rajpur Road, Dehradun | AUDI 04 | 96 | 4 | 4.2 | 1,880 | Available |
| Vadodara | 19:20 | AVAILABLE | 3 | 0 | 400.0-400.0 | Cinepolis Inorbit Mall, Gorwa, Vadodara | AUDI 1 | 146 | 6 | 4.1 | 2,400 | Available |
| Goa | 07:15 | AVAILABLE | 5 | 0 | 320.0-520.0 | INOX Old GMC, DB Road, Goa | SCREEN 1 | 465 | 19 | 4.1 | 7,850 | Available |
| Jamshedpur | 15:55 | AVAILABLE | 4 | 0 | 280.0-430.0 | Miraj Cinemas : Chandra Pacific Mall, Golmuri | SCREEN2 | 272 | 11 | 4.0 | 3,590 | Available |
| Rajkot | 11:00 | AVAILABLE | 6 | 0 | 300.0-380.0 | Cinepolis Vandana, Gondal Road, Rajkot | AUDI 2 | 199 | 8 | 4.0 | 2,740 | Available |
| Rajkot | 23:45 | AVAILABLE | 6 | 0 | 360.0-480.0 | Cinepolis Vandana, Gondal Road, Rajkot | AUDI 2 | 199 | 8 | 4.0 | 3,520 | Available |
| Lucknow | 19:40 | AVAILABLE | 4 | 0 | 450.0-850.0 | INOX Megaplex Phoenix Palassio Mall, Amar Sahe | SCREEN 7 | 203 | 8 | 3.9 | 5,200 | Available |
| Ludhiana | 15:05 | AVAILABLE | 6 | 0 | 370.0-700.0 | Cinepolis Nexus MBD, Ludhiana | AUDI 4 | 330 | 13 | 3.9 | 5,530 | Available |
| Surat | 07:45 | AVAILABLE | 4 | 0 | 320.0-490.0 | PVR Rahul Raj Mall, Dumas Road, Surat | AUDI 08 | 154 | 6 | 3.9 | 1,920 | Available |
| Surat | 19:25 | AVAILABLE | 2 | 0 | 800.0-800.0 | INOX VR Surat, Dumas Road, Surat | SCREEN 1 | 52 | 2 | 3.8 | 1,600 | Available |
| Ahmedabad | 07:00 | AVAILABLE | 5 | 0 | 310.0-630.0 | PVR Acropolis, Acropolis Mall, Ahmedabad | AUDI 04 | 288 | 11 | 3.8 | 4,990 | Available |
| Jalandhar | 10:40 | AVAILABLE | 5 | 0 | 350.0-720.0 | INOX Jalandhar Reliance Mall, Reliance Mall, J | SCREEN 3 | 265 | 10 | 3.8 | 3,920 | Available |
| Ludhiana | 13:15 | AVAILABLE | 6 | 0 | 370.0-700.0 | Cinepolis Nexus MBD, Ludhiana | AUDI 1 | 398 | 15 | 3.8 | 7,050 | Available |
| Bhopal | 16:30 | AVAILABLE | 4 | 0 | 330.0-410.0 | Cinepolis Aashima Mall, Bawadiya Kalan, Bhopal | AUDI04 | 215 | 8 | 3.7 | 3,160 | Available |
| Chandigarh | 14:15 | AVAILABLE | 2 | 0 | 260.0-270.0 | Fun Cinemas Republic Mall, MDC Sector 5, Chand | SCREEN 4 | 270 | 10 | 3.7 | 2,700 | Available |
| Chandigarh | 18:30 | AVAILABLE | 2 | 0 | 260.0-270.0 | Fun Cinemas Republic Mall, MDC Sector 5, Chand | SCREEN 4 | 270 | 10 | 3.7 | 2,700 | Available |
| Chandigarh | 22:45 | AVAILABLE | 2 | 0 | 260.0-270.0 | Fun Cinemas Republic Mall, MDC Sector 5, Chand | SCREEN 4 | 270 | 10 | 3.7 | 2,700 | Available |
| Jaipur | 18:30 | AVAILABLE | 5 | 0 | 420.0-920.0 | Cinepolis Jewel of India, Jaipur | AUDI 4 | 165 | 6 | 3.6 | 3,120 | Available |
| Jaipur | 22:45 | AVAILABLE | 5 | 0 | 420.0-920.0 | Cinepolis Jewel of India, Jaipur | AUDI 4 | 165 | 6 | 3.6 | 3,120 | Available |
| Ludhiana | 23:35 | AVAILABLE | 6 | 0 | 390.0-900.0 | Cinepolis Nexus MBD, Ludhiana | AUDI 4 | 330 | 12 | 3.6 | 5,360 | Available |
| Amritsar | 13:15 | AVAILABLE | 6 | 0 | 290.0-800.0 | Cinepolis Nexus, Sultan Wind Sub Urban Main GT | AUDI 2 | 332 | 12 | 3.6 | 4,950 | Available |
| Amritsar | 17:30 | AVAILABLE | 6 | 0 | 290.0-800.0 | Cinepolis Nexus, Sultan Wind Sub Urban Main GT | AUDI 2 | 332 | 12 | 3.6 | 4,990 | Available |
| Dehradun | 15:10 | AVAILABLE | 4 | 0 | 420.0-850.0 | PVR Centrio, Unison Mall, Dehradun | AUDI 05 | 195 | 7 | 3.6 | 3,500 | Available |
| Agra | 23:30 | AVAILABLE | 5 | 0 | 370.0-570.0 | PVR Anjana Mall, Agra | AUDI 4 | 113 | 4 | 3.5 | 1,600 | Available |
| Surat | 12:15 | AVAILABLE | 3 | 0 | 350.0-370.0 | Cinepolis Imperial Square Mall, Adajan, Surat | AUDI 6 | 283 | 10 | 3.5 | 3,700 | Available |
| Surat | 16:30 | AVAILABLE | 3 | 0 | 350.0-370.0 | Cinepolis Imperial Square Mall, Adajan, Surat | AUDI 6 | 283 | 10 | 3.5 | 3,700 | Available |
| Surat | 20:45 | AVAILABLE | 3 | 0 | 380.0-400.0 | Cinepolis Imperial Square Mall, Adajan, Surat | AUDI 6 | 283 | 10 | 3.5 | 4,000 | Available |
| Ludhiana | 17:30 | AVAILABLE | 6 | 0 | 390.0-900.0 | Cinepolis Nexus MBD, Ludhiana | AUDI 1 | 398 | 14 | 3.5 | 8,100 | Available |
| Indore | 17:30 | AVAILABLE | 4 | 0 | 430.0-490.0 | INOX Phoenix Pride of India, Indore | SCREEN 2 | 172 | 6 | 3.5 | 2,640 | Available |
| Surat | 09:00 | AVAILABLE | 3 | 0 | 280.0-300.0 | Cinepolis Imperial Square Mall, Adajan, Surat | AUDI 5 | 290 | 10 | 3.4 | 3,000 | Available |
| Surat | 13:15 | AVAILABLE | 3 | 0 | 350.0-370.0 | Cinepolis Imperial Square Mall, Adajan, Surat | AUDI 5 | 290 | 10 | 3.4 | 3,700 | Available |
| Surat | 17:30 | AVAILABLE | 3 | 0 | 350.0-370.0 | Cinepolis Imperial Square Mall, Adajan, Surat | AUDI 5 | 290 | 10 | 3.4 | 3,700 | Available |
| Vadodara | 12:15 | AVAILABLE | 3 | 0 | 350.0-390.0 | Cinepolis Inorbit Mall, Gorwa, Vadodara | AUDI 3 | 174 | 6 | 3.4 | 2,340 | Available |
| Vadodara | 16:30 | AVAILABLE | 3 | 0 | 400.0-400.0 | Cinepolis Inorbit Mall, Gorwa, Vadodara | AUDI 3 | 174 | 6 | 3.4 | 2,400 | Available |
| Vadodara | 20:45 | AVAILABLE | 3 | 0 | 400.0-400.0 | Cinepolis Inorbit Mall, Gorwa, Vadodara | AUDI 3 | 174 | 6 | 3.4 | 2,400 | Available |
| Vadodara | 23:35 | AVAILABLE | 3 | 0 | 400.0-400.0 | Cinepolis Inorbit Mall, Gorwa, Vadodara | AUDI 1 | 146 | 5 | 3.4 | 2,000 | Available |
| Raipur | 07:45 | AVAILABLE | 4 | 0 | 220.0-460.0 | Miraj Cinemas : CBD, Nava Raipur | SCREEN 2 | 117 | 4 | 3.4 | 960 | Available |
| Chandigarh | 14:50 | AVAILABLE | 5 | 0 | 400.0-890.0 | PVR Elante Mall, Chandigarh | AUDI 6 | 294 | 10 | 3.4 | 7,060 | Available |
| Guwahati | 13:15 | AVAILABLE | 5 | 0 | 330.0-960.0 | Cinepolis Central Mall, Christian Basti, Guwah | AUDI 2 | 209 | 7 | 3.3 | 2,870 | Available |
| Amritsar | 21:45 | AVAILABLE | 6 | 0 | 290.0-800.0 | Cinepolis Nexus, Sultan Wind Sub Urban Main GT | AUDI 2 | 332 | 11 | 3.3 | 4,620 | Available |
| Dehradun | 10:15 | AVAILABLE | 6 | 0 | 300.0-630.0 | PVR Mall Of Dehradun | SCREEN 3 | 121 | 4 | 3.3 | 1,520 | Available |
| Dehradun | 22:30 | AVAILABLE | 6 | 0 | 390.0-800.0 | PVR Mall Of Dehradun | SCREEN 3 | 121 | 4 | 3.3 | 2,560 | Available |
| Ranchi | 08:05 | AVAILABLE | 3 | 0 | 270.0-270.0 | Miraj Cinemas : Sandhya Tower, Ranchi | SCREEN 2 | 334 | 11 | 3.3 | 2,970 | Available |
| Delhi-NCR | 20:50 | AVAILABLE | 5 | 0 | 340.0-840.0 | Cinepolis City Life Mall, Sec-28, Faridabad | SCREEN 01 | 152 | 5 | 3.3 | 2,000 | Available |
| Bhopal | 11:40 | AVAILABLE | 4 | 0 | 270.0-610.0 | PVR Aura Mall, Shahpura, Bhopal | SCREEN2 | 308 | 10 | 3.2 | 3,280 | Available |
| Chandigarh | 09:30 | AVAILABLE | 5 | 0 | 230.0-300.0 | PVR Centra, Industrial Phase 1, Chandigarh | AUDI 1 | 278 | 9 | 3.2 | 2,420 | Available |
| Kanpur | 21:50 | AVAILABLE | 4 | 0 | 410.0-1160.0 | INOX Z Square Mall, Bada Chauraha, Kanpur | SCREEN 1 | 280 | 9 | 3.2 | 4,230 | Available |
| Kolkata | 13:15 | AVAILABLE | 3 | 0 | 400.0-440.0 | Cinepolis Acropolis Mall, Rajdanga Road, Kolka | AUDI04 | 252 | 8 | 3.2 | 3,440 | Available |
| Kolkata | 21:45 | AVAILABLE | 3 | 0 | 400.0-440.0 | Cinepolis Acropolis Mall, Rajdanga Road, Kolka | AUDI04 | 252 | 8 | 3.2 | 3,440 | Available |
| Indore | 14:20 | AVAILABLE | 6 | 0 | 430.0-900.0 | PVR Treasure Island Mall, South Tukoganj, Indo | AUDI 3 | 254 | 8 | 3.1 | 4,640 | Available |
| Lucknow | 22:00 | AVAILABLE | 4 | 0 | 450.0-850.0 | PVR SUPERPLEX Lulu, Lulu Mall, Lucknow | AUDI 02 | 254 | 8 | 3.1 | 3,600 | Available |
| Ludhiana | 17:25 | AVAILABLE | 5 | 0 | 380.0-570.0 | PVR Pavilion Mall, Ludhiana | AUDI 3 | 127 | 4 | 3.1 | 1,680 | Available |
| Kanpur | 21:55 | AVAILABLE | 3 | 0 | 380.0-660.0 | PVR Deep, Saket Nagar, Kanpur | AUDI 01 | 191 | 6 | 3.1 | 2,460 | Available |
| Mumbai | 19:45 | AVAILABLE | 4 | 0 | 530.0-1080.0 | PVR Infiniti Malad, Malad (W), Mumbai | SCREEN 3 | 163 | 5 | 3.1 | 2,750 | Available |
| Jamshedpur | 16:30 | AVAILABLE | 4 | 0 | 320.0-700.0 | PJP Cinepolis City Centre Mall, Mauja, Jamshed | SCREEN 5 | 263 | 8 | 3.0 | 2,880 | Available |
| Lucknow | 13:45 | AVAILABLE | 4 | 0 | 350.0-800.0 | Cinepolis One Awadh Center Mall, Gomti Nagar,  | SCREEN 1 | 199 | 6 | 3.0 | 2,100 | Available |
| Lucknow | 17:10 | AVAILABLE | 4 | 0 | 310.0-560.0 | INOX Umrao Mall, Mahanagar, Lucknow | SCREEN 3 | 202 | 6 | 3.0 | 1,860 | Available |
| Nagpur | 08:00 | AVAILABLE | 4 | 0 | 280.0-310.0 | INOX Jaswant Tuli Mall, Kamptee Road, Nagpur | SCREEN 2 | 305 | 9 | 3.0 | 2,700 | Available |
| Jamshedpur | 19:50 | AVAILABLE | 4 | 0 | 300.0-500.0 | Miraj Cinemas : Chandra Pacific Mall, Golmuri | SCREEN2 | 272 | 8 | 2.9 | 2,720 | Available |
| Bhopal | 19:50 | AVAILABLE | 4 | 0 | 350.0-790.0 | PVR Aura Mall, Shahpura, Bhopal | SCREEN2 | 308 | 9 | 2.9 | 3,690 | Available |
| Indore | 09:50 | AVAILABLE | 4 | 0 | 280.0-340.0 | INOX Phoenix Pride of India, Indore | SCREEN 2 | 172 | 5 | 2.9 | 1,510 | Available |
| Chandigarh | 17:40 | AVAILABLE | 5 | 0 | 270.0-350.0 | PVR Centra, Industrial Phase 1, Chandigarh | AUDI 1 | 278 | 8 | 2.9 | 2,560 | Available |
| Delhi-NCR | 15:50 | AVAILABLE | 2 | 0 | 570.0-620.0 | PVR Vegas, Dwarka, New Delhi | AUDI 08 | 209 | 6 | 2.9 | 3,420 | Available |
| Guwahati | 09:00 | AVAILABLE | 5 | 0 | 280.0-680.0 | Cinepolis Central Mall, Christian Basti, Guwah | AUDI 2 | 209 | 6 | 2.9 | 1,920 | Available |
| Guwahati | 21:45 | AVAILABLE | 5 | 0 | 330.0-960.0 | Cinepolis Central Mall, Christian Basti, Guwah | AUDI 2 | 209 | 6 | 2.9 | 2,460 | Available |
| Guwahati | 23:35 | AVAILABLE | 5 | 0 | 330.0-960.0 | Cinepolis Central Mall, Christian Basti, Guwah | AUDI 1 | 209 | 6 | 2.9 | 2,460 | Available |
| Kanpur | 14:10 | AVAILABLE | 4 | 0 | 400.0-950.0 | INOX Z Square Mall, Bada Chauraha, Kanpur | SCREEN 1 | 280 | 8 | 2.9 | 3,450 | Available |
| Goa | 10:30 | AVAILABLE | 4 | 0 | 290.0-470.0 | INOX Porvorim, Bardez, Goa | SCREEN 2 | 213 | 6 | 2.8 | 2,260 | Available |
| Goa | 18:30 | AVAILABLE | 4 | 0 | 410.0-780.0 | INOX Porvorim, Bardez, Goa | SCREEN 2 | 213 | 6 | 2.8 | 2,700 | Available |
| Ludhiana | 09:00 | AVAILABLE | 6 | 0 | 280.0-550.0 | Cinepolis Nexus MBD, Ludhiana | AUDI 1 | 398 | 11 | 2.8 | 3,950 | Available |
| Vadodara | 09:00 | AVAILABLE | 3 | 0 | 230.0-270.0 | Cinepolis Inorbit Mall, Gorwa, Vadodara | AUDI 2 | 182 | 5 | 2.7 | 1,350 | Available |
| Jaipur | 18:10 | AVAILABLE | 4 | 0 | 440.0-480.0 | INOX GT Central Mall, Malviya Nagar, Jaipur | SCREEN 1 | 220 | 6 | 2.7 | 2,880 | Available |
| Siliguri | 22:15 | AVAILABLE | 3 | 0 | 320.0-460.0 | INOX ML Acropolis Mall, Siliguri | AUDI 1 | 223 | 6 | 2.7 | 2,760 | Available |
| Pune | 15:30 | AVAILABLE | 4 | 0 | 400.0-470.0 | Cinepolis Seasons Mall, Hadapsar, Pune | AUDI 01 | 261 | 7 | 2.7 | 3,290 | Available |
| Amritsar | 08:00 | AVAILABLE | 4 | 0 | 290.0-340.0 | INOX VR Ambarsar, Circular Road, Amritsar | SCREEN 5 | 116 | 3 | 2.6 | 1,020 | Available |
| Rajkot | 07:05 | AVAILABLE | 3 | 0 | 330.0-350.0 | INOX R World, Kasturba Road, Rajkot | SCREEN 3 | 232 | 6 | 2.6 | 2,070 | Available |
| Dehradun | 11:05 | AVAILABLE | 4 | 0 | 340.0-690.0 | PVR Centrio, Unison Mall, Dehradun | AUDI 05 | 195 | 5 | 2.6 | 2,370 | Available |
| Mumbai | 06:55 | AVAILABLE | 5 | 0 | 330.0-580.0 | PVR Infiniti Malad, Malad (W), Mumbai | SCREEN 2 | 237 | 6 | 2.5 | 2,680 | Available |
| Lucknow | 17:40 | AVAILABLE | 3 | 0 | 450.0-450.0 | INOX Megaplex Phoenix Palassio Mall, Amar Sahe | SCREEN 5 | 119 | 3 | 2.5 | 1,350 | Available |
| Pune | 16:15 | AVAILABLE | 4 | 0 | 400.0-470.0 | Cinepolis Seasons Mall, Hadapsar, Pune | AUDI 02 | 241 | 6 | 2.5 | 2,820 | Available |
| Mumbai | 07:55 | AVAILABLE | 4 | 0 | 330.0-580.0 | PVR Infiniti Malad, Malad (W), Mumbai | SCREEN 3 | 163 | 4 | 2.5 | 1,400 | Available |
| Mumbai | 11:35 | AVAILABLE | 4 | 0 | 330.0-580.0 | PVR Infiniti Malad, Malad (W), Mumbai | SCREEN 3 | 163 | 4 | 2.5 | 1,440 | Available |
| Kanpur | 11:00 | AVAILABLE | 6 | 0 | 290.0-640.0 | Miraj Cinemas : Gurudev Pammi, Kanpur | GURDEV | 408 | 10 | 2.5 | 6,400 | Available |
| Kanpur | 15:00 | AVAILABLE | 6 | 0 | 290.0-690.0 | Miraj Cinemas : Gurudev Pammi, Kanpur | GURDEV | 408 | 10 | 2.5 | 6,900 | Available |
| Kanpur | 19:00 | AVAILABLE | 6 | 0 | 300.0-700.0 | Miraj Cinemas : Gurudev Pammi, Kanpur | GURDEV | 408 | 10 | 2.5 | 7,000 | Available |
| Kanpur | 22:50 | AVAILABLE | 6 | 0 | 300.0-700.0 | Miraj Cinemas : Gurudev Pammi, Kanpur | GURDEV | 408 | 10 | 2.5 | 7,000 | Available |
| Indore | 15:50 | AVAILABLE | 6 | 0 | 430.0-900.0 | PVR Treasure Island Mall, South Tukoganj, Indo | AUDI 1 | 291 | 7 | 2.4 | 3,340 | Available |
| Ludhiana | 13:20 | AVAILABLE | 5 | 0 | 380.0-570.0 | PVR Pavilion Mall, Ludhiana | AUDI 3 | 127 | 3 | 2.4 | 1,260 | Available |
| Lucknow | 19:10 | AVAILABLE | 3 | 0 | 450.0-600.0 | PVR Phoenix United Mall, Alambagh, Lucknow | AUDI 02 | 382 | 9 | 2.4 | 4,050 | Available |
| Dehradun | 22:20 | AVAILABLE | 3 | 0 | 460.0-920.0 | PVR Pacific Mall, Main Rajpur Road, Dehradun | AUDI 01 NEW | 170 | 4 | 2.4 | 2,840 | Available |
| Siliguri | 13:05 | AVAILABLE | 3 | 0 | 320.0-460.0 | INOX ML Acropolis Mall, Siliguri | AUDI 4 | 256 | 6 | 2.3 | 2,760 | Available |
| Indore | 23:20 | AVAILABLE | 6 | 0 | 500.0-580.0 | INOX Phoenix Pride of India, Indore | SCREEN 1 | 299 | 7 | 2.3 | 3,850 | Available |
| Ahmedabad | 07:35 | AVAILABLE | 3 | 0 | 220.0-310.0 | Miraj Cinemas : Shalin Square, Hathijan | SCREEN 4 | 87 | 2 | 2.3 | 440 | Available |
| Pune | 13:15 | AVAILABLE | 5 | 0 | 480.0-580.0 | Cinepolis Nexus Westend, Aundh, Pune | AUDI03 | 261 | 6 | 2.3 | 3,360 | Available |
| Pune | 17:30 | AVAILABLE | 5 | 0 | 500.0-600.0 | Cinepolis Nexus Westend, Aundh, Pune | AUDI03 | 261 | 6 | 2.3 | 3,480 | Available |
| Nagpur | 19:50 | AVAILABLE | 4 | 0 | 370.0-420.0 | INOX Jaswant Tuli Mall, Kamptee Road, Nagpur | SCREEN 2 | 305 | 7 | 2.3 | 2,810 | Available |
| Amritsar | 14:20 | AVAILABLE | 4 | 0 | 340.0-390.0 | INOX VR Ambarsar, Circular Road, Amritsar | SCREEN 4 | 308 | 7 | 2.3 | 2,730 | Available |
| Indore | 14:05 | AVAILABLE | 2 | 0 | 1010.0-1040.0 | INOX C-21 Mall, Sheetal Nagar, Indore | INSIGNIA 9 | 44 | 1 | 2.3 | 1,040 | Available |
| Jalandhar | 10:15 | AVAILABLE | 6 | 0 | 330.0-630.0 | PVR Friends, Jalandhar | AUDI 01 | 138 | 3 | 2.2 | 1,110 | Available |
| Ahmedabad | 07:50 | AVAILABLE | 5 | 0 | 320.0-400.0 | INOX Himalaya Mall, Drive In Road, Ahmedabad | SCREEN 3 | 235 | 5 | 2.1 | 1,980 | Available |
| Dehradun | 16:55 | AVAILABLE | 2 | 0 | 430.0-470.0 | PVR Pacific Mall, Main Rajpur Road, Dehradun | AUDI 04 | 96 | 2 | 2.1 | 940 | Available |
| Rajkot | 15:15 | AVAILABLE | 6 | 0 | 320.0-460.0 | Cinepolis Vandana, Gondal Road, Rajkot | AUDI 2 | 199 | 4 | 2.0 | 1,680 | Available |
| Lucknow | 15:35 | AVAILABLE | 4 | 0 | 450.0-850.0 | INOX Megaplex Phoenix Palassio Mall, Amar Sahe | SCREEN 7 | 203 | 4 | 2.0 | 1,800 | Available |
| Indore | 18:10 | AVAILABLE | 6 | 0 | 450.0-940.0 | PVR Treasure Island Mall, South Tukoganj, Indo | AUDI 3 | 254 | 5 | 2.0 | 2,500 | Available |
| Indore | 22:00 | AVAILABLE | 6 | 0 | 450.0-940.0 | PVR Treasure Island Mall, South Tukoganj, Indo | AUDI 3 | 254 | 5 | 2.0 | 3,840 | Available |
| Pune | 15:45 | AVAILABLE | 5 | 0 | 440.0-750.0 | PVR Kumar Pacific Mall, Swar Gate, Pune | AUDI 03 | 207 | 4 | 1.9 | 3,000 | Available |
| Ludhiana | 14:05 | AVAILABLE | 3 | 0 | 350.0-590.0 | PVR Avon City Mall, Gurdev Nagar, Ludhiana | AUDI 04 | 163 | 3 | 1.8 | 1,230 | Available |
| Siliguri | 14:45 | AVAILABLE | 3 | 0 | 280.0-440.0 | INOX City Centre, Matigara, Siliguri | SCREEN 2 | 218 | 4 | 1.8 | 1,560 | Available |
| Nagpur | 22:05 | AVAILABLE | 4 | 0 | 370.0-440.0 | INOX Jaswant Tuli Mall, Kamptee Road, Nagpur | SCREEN 4 | 273 | 5 | 1.8 | 2,110 | Available |
| Bhopal | 15:15 | AVAILABLE | 4 | 0 | 370.0-490.0 | Cinepolis DB Mall, Maharana Pratap Nagar, Bhop | AUDI 3 | 329 | 6 | 1.8 | 2,820 | Available |
| Bhopal | 19:30 | AVAILABLE | 4 | 0 | 390.0-470.0 | Cinepolis DB Mall, Maharana Pratap Nagar, Bhop | AUDI 3 | 329 | 6 | 1.8 | 2,700 | Available |
| Raipur | 09:00 | AVAILABLE | 4 | 0 | 300.0-690.0 | PVR Zora The Mall, Raipur | SCREEN 5 | 168 | 3 | 1.8 | 1,730 | Available |
| Dehradun | 14:10 | AVAILABLE | 3 | 0 | 430.0-870.0 | PVR Pacific Mall, Main Rajpur Road, Dehradun | AUDI 01 NEW | 170 | 3 | 1.8 | 1,410 | Available |
| Jamshedpur | 17:30 | AVAILABLE | 3 | 0 | 320.0-360.0 | PJP Cinepolis City Centre Mall, Mauja, Jamshed | SCREEN 3 | 114 | 2 | 1.8 | 720 | Available |
| Indore | 13:40 | AVAILABLE | 4 | 0 | 430.0-490.0 | INOX Phoenix Pride of India, Indore | SCREEN 2 | 172 | 3 | 1.7 | 1,380 | Available |
| Surat | 17:45 | AVAILABLE | 4 | 0 | 300.0-600.0 | Miraj Cinemas : KSB Mall, Surat | SCREEN 1 | 231 | 4 | 1.7 | 1,200 | Available |
| Lucknow | 13:35 | AVAILABLE | 3 | 0 | 450.0-450.0 | INOX Megaplex Phoenix Palassio Mall, Amar Sahe | SCREEN 5 | 119 | 2 | 1.7 | 900 | Available |
| Delhi-NCR | 07:05 | AVAILABLE | 2 | 0 | 370.0-400.0 | PVR Pacific D21, Dwarka, New Delhi | AUDI 01 | 244 | 4 | 1.6 | 1,480 | Available |
| Ludhiana | 09:15 | AVAILABLE | 5 | 0 | 280.0-490.0 | PVR Pavilion Mall, Ludhiana | AUDI 3 | 127 | 2 | 1.6 | 640 | Available |
| Jalandhar | 10:30 | AVAILABLE | 7 | 0 | 340.0-660.0 | PVR MBD Neopolis Mall, Sehdev Market, Jalandha | AUDI 03 | 329 | 5 | 1.5 | 2,310 | Available |
| Chandigarh | 21:15 | AVAILABLE | 5 | 0 | 320.0-680.0 | PVR DLF City Center Mall, IT Park, Chandigarh | AUDI 1 | 198 | 3 | 1.5 | 2,040 | Available |
| Jalandhar | 18:50 | AVAILABLE | 5 | 0 | 410.0-820.0 | INOX Jalandhar Reliance Mall, Reliance Mall, J | SCREEN 3 | 265 | 4 | 1.5 | 2,920 | Available |
| Goa | 15:00 | AVAILABLE | 5 | 0 | 420.0-790.0 | INOX Old GMC, DB Road, Goa | SCREEN 1 | 465 | 7 | 1.5 | 4,350 | Available |
| Ranchi | 15:55 | AVAILABLE | 3 | 0 | 360.0-360.0 | Miraj Cinemas : Sandhya Tower, Ranchi | SCREEN 2 | 334 | 5 | 1.5 | 1,800 | Available |
| Nagpur | 09:50 | AVAILABLE | 4 | 0 | 280.0-330.0 | INOX Jaswant Tuli Mall, Kamptee Road, Nagpur | SCREEN 4 | 273 | 4 | 1.5 | 1,200 | Available |
| Ludhiana | 20:20 | AVAILABLE | 5 | 0 | 370.0-640.0 | PVR Silver Arc Mall, Gurdev Nagar, Ludhiana | AUDI 05 | 139 | 2 | 1.4 | 960 | Available |
| Delhi-NCR | 23:59 | AVAILABLE | 2 | 0 | 600.0-650.0 | PVR Vegas, Dwarka, New Delhi | AUDI 08 | 209 | 3 | 1.4 | 1,900 | Available |
| Surat | 23:45 | AVAILABLE | 4 | 0 | 460.0-750.0 | PVR Rahul Raj Mall, Dumas Road, Surat | AUDI 08 | 154 | 2 | 1.3 | 920 | Available |
| Amritsar | 13:05 | AVAILABLE | 6 | 0 | 330.0-570.0 | PVR SCT City Centre, City Centre, Amritsar | AUDI 3 | 158 | 2 | 1.3 | 680 | Available |
| Bhopal | 23:45 | AVAILABLE | 4 | 0 | 390.0-470.0 | Cinepolis DB Mall, Maharana Pratap Nagar, Bhop | AUDI 3 | 329 | 4 | 1.2 | 1,800 | Available |
| Indore | 16:05 | AVAILABLE | 6 | 0 | 430.0-900.0 | INOX C-21 Mall, Sheetal Nagar, Indore | SCREEN 4 | 254 | 3 | 1.2 | 1,440 | Available |
| Siliguri | 09:00 | AVAILABLE | 3 | 0 | 320.0-460.0 | INOX ML Acropolis Mall, Siliguri | AUDI 4 | 256 | 3 | 1.2 | 1,140 | Available |
| Indore | 07:25 | AVAILABLE | 3 | 0 | 330.0-360.0 | INOX C-21 Mall, Sheetal Nagar, Indore | SCREEN 6 | 173 | 2 | 1.2 | 720 | Available |
| Delhi-NCR | 19:00 | AVAILABLE | 2 | 0 | 410.0-460.0 | Miraj Cinemas : India Expo Plaza, Greater Noid | SCREEN1 | 88 | 1 | 1.1 | 460 | Available |
| Jalandhar | 12:35 | AVAILABLE | 7 | 0 | 380.0-690.0 | PVR MBD Neopolis Mall, Sehdev Market, Jalandha | AUDI 01 | 176 | 2 | 1.1 | 860 | Available |
| Indore | 22:20 | AVAILABLE | 5 | 0 | 470.0-980.0 | INOX Phoenix Pride of India, Indore | SCREEN 4 | 179 | 2 | 1.1 | 1,960 | Available |
| Nashik | 23:00 | AVAILABLE | 3 | 0 | 410.0-620.0 | Cinemax City Center, City Center Mall, Nashik | SCREEN 3 | 185 | 2 | 1.1 | 1,240 | Available |
| Chandigarh | 13:35 | AVAILABLE | 5 | 0 | 270.0-350.0 | PVR Centra, Industrial Phase 1, Chandigarh | AUDI 1 | 278 | 3 | 1.1 | 890 | Available |
| Lucknow | 15:05 | AVAILABLE | 3 | 0 | 450.0-600.0 | PVR Phoenix United Mall, Alambagh, Lucknow | AUDI 02 | 382 | 4 | 1.0 | 1,800 | Available |
| Raipur | 10:45 | AVAILABLE | 5 | 0 | 240.0-530.0 | INOX Ambuja City Centre, Mowa, Raipur | SCREEN 1 | 197 | 2 | 1.0 | 600 | Available |
| Amritsar | 10:15 | AVAILABLE | 4 | 0 | 290.0-340.0 | INOX VR Ambarsar, Circular Road, Amritsar | SCREEN 4 | 308 | 3 | 1.0 | 1,020 | Available |
| Delhi-NCR | 09:55 | AVAILABLE | 6 | 0 | 330.0-660.0 | INOX World Mark, Sector 65, Gurugram | SCREEN 1 | 215 | 2 | 0.9 | 1,320 | Available |
| Jalandhar | 18:40 | AVAILABLE | 7 | 0 | 400.0-730.0 | PVR MBD Neopolis Mall, Sehdev Market, Jalandha | AUDI 03 | 329 | 3 | 0.9 | 1,350 | Available |
| Siliguri | 10:00 | AVAILABLE | 3 | 0 | 320.0-460.0 | INOX ML Acropolis Mall, Siliguri | AUDI 1 | 223 | 2 | 0.9 | 680 | Available |
| Jamshedpur | 21:45 | AVAILABLE | 3 | 0 | 340.0-380.0 | PJP Cinepolis City Centre Mall, Mauja, Jamshed | SCREEN 3 | 114 | 1 | 0.9 | 380 | Available |
| Lucknow | 17:55 | AVAILABLE | 4 | 0 | 450.0-850.0 | PVR SUPERPLEX Lulu, Lulu Mall, Lucknow | AUDI 02 | 254 | 2 | 0.8 | 900 | Available |
| Jamshedpur | 08:05 | AVAILABLE | 4 | 0 | 260.0-410.0 | Miraj Cinemas : Chandra Pacific Mall, Golmuri | SCREEN2 | 272 | 2 | 0.7 | 560 | Available |
| Jamshedpur | 23:45 | AVAILABLE | 4 | 0 | 300.0-500.0 | Miraj Cinemas : Chandra Pacific Mall, Golmuri | SCREEN2 | 272 | 2 | 0.7 | 680 | Available |
| Ludhiana | 08:05 | AVAILABLE | 5 | 0 | 270.0-600.0 | PVR Silver Arc Mall, Gurdev Nagar, Ludhiana | AUDI 05 | 139 | 1 | 0.7 | 310 | Available |
| Indore | 11:00 | AVAILABLE | 4 | 0 | 270.0-300.0 | INOX Nexus Indore Central, Regal Square, Indor | SCREEN 3 | 289 | 2 | 0.7 | 560 | Available |
| Delhi-NCR | 12:30 | AVAILABLE | 2 | 0 | 400.0-500.0 | Miraj Cinemas : Chand, Mayur Vihar Phase 1 | SCREEN 4 | 146 | 1 | 0.7 | 500 | Available |
| Delhi-NCR | 16:45 | AVAILABLE | 2 | 0 | 400.0-500.0 | Miraj Cinemas : Chand, Mayur Vihar Phase 1 | SCREEN 4 | 146 | 1 | 0.7 | 400 | Available |
| Nagpur | 15:45 | AVAILABLE | 4 | 0 | 350.0-400.0 | INOX Jaswant Tuli Mall, Kamptee Road, Nagpur | SCREEN 2 | 305 | 2 | 0.7 | 780 | Available |
| Nagpur | 23:55 | AVAILABLE | 4 | 0 | 370.0-420.0 | INOX Jaswant Tuli Mall, Kamptee Road, Nagpur | SCREEN 2 | 305 | 2 | 0.7 | 820 | Available |
| Amritsar | 22:30 | AVAILABLE | 4 | 0 | 360.0-410.0 | INOX VR Ambarsar, Circular Road, Amritsar | SCREEN 4 | 308 | 2 | 0.6 | 780 | Available |
| Surat | 11:30 | AVAILABLE | 4 | 0 | 320.0-490.0 | PVR Rahul Raj Mall, Dumas Road, Surat | AUDI 08 | 154 | 1 | 0.6 | 320 | Available |
| Ranchi | 12:00 | AVAILABLE | 3 | 0 | 360.0-360.0 | Miraj Cinemas : Sandhya Tower, Ranchi | SCREEN 2 | 334 | 2 | 0.6 | 720 | Available |
| Dehradun | 18:15 | AVAILABLE | 3 | 0 | 460.0-920.0 | PVR Pacific Mall, Main Rajpur Road, Dehradun | AUDI 01 NEW | 170 | 1 | 0.6 | 500 | Available |
| Indore | 10:50 | AVAILABLE | 5 | 0 | 280.0-580.0 | INOX Phoenix Pride of India, Indore | SCREEN 4 | 179 | 1 | 0.6 | 310 | Available |
| Vadodara | 11:00 | AVAILABLE | 4 | 0 | 240.0-420.0 | INOX Reliance Mega Mall, Old Padra Road, Vadod | SCREEN 3 | 228 | 1 | 0.4 | 240 | Available |
| Surat | 10:15 | AVAILABLE | 4 | 0 | 250.0-460.0 | Miraj Cinemas : KSB Mall, Surat | SCREEN 2 | 231 | 1 | 0.4 | 250 | Available |
| Rajkot | 10:45 | AVAILABLE | 3 | 0 | 330.0-350.0 | INOX R World, Kasturba Road, Rajkot | SCREEN 3 | 232 | 1 | 0.4 | 350 | Available |
| Rajkot | 14:50 | AVAILABLE | 3 | 0 | 410.0-430.0 | INOX R World, Kasturba Road, Rajkot | SCREEN 3 | 232 | 1 | 0.4 | 430 | Available |
| Rajkot | 23:00 | AVAILABLE | 3 | 0 | 430.0-450.0 | INOX R World, Kasturba Road, Rajkot | SCREEN 3 | 232 | 1 | 0.4 | 450 | Available |
| Mumbai | 14:40 | AVAILABLE | 5 | 0 | 530.0-1080.0 | PVR Infiniti Malad, Malad (W), Mumbai | SCREEN 2 | 237 | 1 | 0.4 | 550 | Available |
| Lucknow | 10:15 | AVAILABLE | 4 | 0 | 400.0-600.0 | INOX Megaplex Emerald, Ashiyana, Lucknow | SCREEN 3 | 241 | 1 | 0.4 | 400 | Available |
| Ludhiana | 17:35 | AVAILABLE | 6 | 0 | 350.0-460.0 | PVR Silver Arc Mall, Gurdev Nagar, Ludhiana | AUDI 01 | 270 | 1 | 0.4 | 390 | Available |
| Ahmedabad | 11:40 | AVAILABLE | 3 | 0 | 350.0-450.0 | Miraj Cinemas : Shalin Square, Hathijan | SCREEN 4 | 87 | 0 | 0.0 | 0 | Available |
| Ahmedabad | 15:45 | AVAILABLE | 3 | 0 | 300.0-400.0 | Miraj Cinemas : Shalin Square, Hathijan | SCREEN 4 | 87 | 0 | 0.0 | 0 | Available |
| Ahmedabad | 18:00 | AVAILABLE | 3 | 0 | 360.0-460.0 | Miraj Cinemas : Shalin Square, Hathijan | SCREEN 1 | 88 | 0 | 0.0 | 0 | Available |
| Ahmedabad | 19:50 | AVAILABLE | 3 | 0 | 320.0-420.0 | Miraj Cinemas : Shalin Square, Hathijan | SCREEN 4 | 87 | 0 | 0.0 | 0 | Available |
| Amritsar | 10:30 | AVAILABLE | 6 | 0 | 290.0-470.0 | PVR SCT City Centre, City Centre, Amritsar | AUDI 1 | 197 | 0 | 0.0 | 0 | Available |
| Amritsar | 11:40 | AVAILABLE | 4 | 0 | 290.0-340.0 | INOX VR Ambarsar, Circular Road, Amritsar | SCREEN 5 | 116 | 0 | 0.0 | 0 | Available |
| Amritsar | 15:45 | AVAILABLE | 4 | 0 | 340.0-390.0 | INOX VR Ambarsar, Circular Road, Amritsar | SCREEN 5 | 116 | 0 | 0.0 | 0 | Available |
| Amritsar | 18:40 | AVAILABLE | 6 | 0 | 350.0-610.0 | PVR SCT City Centre, City Centre, Amritsar | AUDI 1 | 197 | 0 | 0.0 | 0 | Available |
| Amritsar | 19:50 | AVAILABLE | 4 | 0 | 360.0-410.0 | INOX VR Ambarsar, Circular Road, Amritsar | SCREEN 5 | 116 | 0 | 0.0 | 0 | Available |
| Amritsar | 21:15 | AVAILABLE | 6 | 0 | 350.0-610.0 | PVR SCT City Centre, City Centre, Amritsar | AUDI 3 | 158 | 0 | 0.0 | 0 | Available |
| Amritsar | 23:55 | AVAILABLE | 4 | 0 | 360.0-410.0 | INOX VR Ambarsar, Circular Road, Amritsar | SCREEN 5 | 116 | 0 | 0.0 | 0 | Available |
| Bhopal | 07:00 | AVAILABLE | 3 | 0 | 350.0-700.0 | Miraj Cinemas : Alark Square, Bhopal | SCREEN 1 | 60 | 0 | 0.0 | 0 | Available |
| Bhopal | 14:00 | AVAILABLE | 3 | 0 | 450.0-900.0 | Miraj Cinemas : Alark Square, Bhopal | SCREEN 2 | 67 | 0 | 0.0 | 0 | Available |
| Bhopal | 15:00 | AVAILABLE | 3 | 0 | 450.0-720.0 | Miraj Cinemas : Alark Square, Bhopal | SCREEN 1 | 60 | 0 | 0.0 | 0 | Available |
| Bhopal | 18:00 | AVAILABLE | 3 | 0 | 500.0-1000.0 | Miraj Cinemas : Alark Square, Bhopal | SCREEN 2 | 67 | 0 | 0.0 | 0 | Available |
| Bhopal | 19:00 | AVAILABLE | 3 | 0 | 450.0-720.0 | Miraj Cinemas : Alark Square, Bhopal | SCREEN 1 | 60 | 0 | 0.0 | 0 | Available |
| Bhopal | 22:00 | AVAILABLE | 3 | 0 | 500.0-1000.0 | Miraj Cinemas : Alark Square, Bhopal | SCREEN 2 | 67 | 0 | 0.0 | 0 | Available |
| Bhopal | 23:00 | AVAILABLE | 3 | 0 | 450.0-720.0 | Miraj Cinemas : Alark Square, Bhopal | SCREEN 1 | 60 | 0 | 0.0 | 0 | Available |
| Bhopal | 23:55 | AVAILABLE | 4 | 0 | 350.0-790.0 | PVR Aura Mall, Shahpura, Bhopal | SCREEN2 | 308 | 0 | 0.0 | 0 | Available |
| Chandigarh | 13:05 | AVAILABLE | 5 | 0 | 310.0-640.0 | PVR DLF City Center Mall, IT Park, Chandigarh | AUDI 1 | 198 | 0 | 0.0 | 0 | Available |
| Chandigarh | 17:10 | AVAILABLE | 5 | 0 | 310.0-640.0 | PVR DLF City Center Mall, IT Park, Chandigarh | AUDI 1 | 198 | 0 | 0.0 | 0 | Available |
| Dehradun | 09:00 | AVAILABLE | 2 | 0 | 350.0-380.0 | PVR Pacific Mall, Main Rajpur Road, Dehradun | AUDI 04 | 96 | 0 | 0.0 | 0 | Available |
| Dehradun | 18:25 | AVAILABLE | 6 | 0 | 390.0-800.0 | PVR Mall Of Dehradun | SCREEN 3 | 121 | 0 | 0.0 | 0 | Available |
| Dehradun | 23:20 | AVAILABLE | 4 | 0 | 440.0-890.0 | PVR Centrio, Unison Mall, Dehradun | AUDI 05 | 195 | 0 | 0.0 | 0 | Available |
| Dehradun | 23:30 | AVAILABLE | 6 | 0 | 390.0-800.0 | PVR Mall Of Dehradun | SCREEN 6 | 226 | 0 | 0.0 | 0 | Available |
| Delhi-NCR | 06:05 | AVAILABLE | 2 | 0 | 420.0-420.0 | Miraj Cinemas : Aakash, Azadpur | SCREEN 2 | 99 | 0 | 0.0 | 0 | Available |
| Delhi-NCR | 07:30 | AVAILABLE | 5 | 0 | 360.0-450.0 | INOX World Mark, Sector 65, Gurugram | SCREEN 2 | 173 | 0 | 0.0 | 0 | Available |
| Delhi-NCR | 08:55 | AVAILABLE | 3 | 0 | 2400.0-2400.0 | Gurugram: PVR Directors Cut Ambience Mall | AUDI 09 DC | 53 | 0 | 0.0 | 0 | Available |
| Delhi-NCR | 10:05 | AVAILABLE | 2 | 0 | 890.0-940.0 | INOX Pacific Mall, Jasola, New Delhi | INSIGNIA 2 | 57 | 0 | 0.0 | 0 | Available |
| Delhi-NCR | 12:20 | AVAILABLE | 5 | 0 | 410.0-530.0 | INOX World Mark, Sector 65, Gurugram | SCREEN 3 | 174 | 0 | 0.0 | 0 | Available |
| Delhi-NCR | 12:45 | AVAILABLE | 2 | 0 | 2100.0-2300.0 | PVR Directors Cut, DLF Mall of India, Noida | AUDI 9 THE VENET | 74 | 0 | 0.0 | 0 | Available |
| Delhi-NCR | 13:00 | AVAILABLE | 1 | 0 | 450.0-450.0 | Miraj Cinemas : TGIP, Noida | SCREEN 4 | 221 | 0 | 0.0 | 0 | Available |
| Delhi-NCR | 14:10 | AVAILABLE | 2 | 0 | 1490.0-1590.0 | INOX Pacific Mall, Jasola, New Delhi | INSIGNIA 2 | 57 | 0 | 0.0 | 0 | Available |
| Delhi-NCR | 15:55 | AVAILABLE | 1 | 0 | 840.0-840.0 | Miraj Cinemas : India Expo Plaza, Greater Noid | SCREEN3 | 22 | 0 | 0.0 | 0 | Available |
| Delhi-NCR | 18:05 | AVAILABLE | 6 | 0 | 440.0-910.0 | INOX World Mark, Sector 65, Gurugram | SCREEN 1 | 215 | 0 | 0.0 | 0 | Available |
| Delhi-NCR | 20:10 | AVAILABLE | 3 | 0 | 2400.0-2400.0 | Gurugram: PVR Directors Cut Ambience Mall | AUDI 09 DC | 53 | 0 | 0.0 | 0 | Available |
| Delhi-NCR | 20:30 | AVAILABLE | 5 | 0 | 440.0-570.0 | INOX World Mark, Sector 65, Gurugram | SCREEN 3 | 174 | 0 | 0.0 | 0 | Available |
| Delhi-NCR | 22:10 | AVAILABLE | 6 | 0 | 440.0-910.0 | INOX World Mark, Sector 65, Gurugram | SCREEN 1 | 215 | 0 | 0.0 | 0 | Available |
| Delhi-NCR | 22:20 | AVAILABLE | 2 | 0 | 1550.0-1650.0 | INOX Pacific Mall, Jasola, New Delhi | INSIGNIA 2 | 57 | 0 | 0.0 | 0 | Available |
| Goa | 14:30 | AVAILABLE | 4 | 0 | 390.0-740.0 | INOX Porvorim, Bardez, Goa | SCREEN 2 | 213 | 0 | 0.0 | 0 | Available |
| Goa | 22:30 | AVAILABLE | 4 | 0 | 410.0-780.0 | INOX Porvorim, Bardez, Goa | SCREEN 2 | 213 | 0 | 0.0 | 0 | Available |
| Goa | 23:00 | AVAILABLE | 5 | 0 | 440.0-830.0 | INOX Old GMC, DB Road, Goa | SCREEN 1 | 465 | 0 | 0.0 | 0 | Available |
| Indore | 11:20 | AVAILABLE | 2 | 0 | 690.0-720.0 | INOX Phoenix Pride of India, Indore | INSIGNIA 8 | 40 | 0 | 0.0 | 0 | Available |
| Indore | 12:15 | AVAILABLE | 6 | 0 | 430.0-900.0 | INOX C-21 Mall, Sheetal Nagar, Indore | SCREEN 4 | 254 | 0 | 0.0 | 0 | Available |
| Indore | 13:20 | AVAILABLE | 3 | 0 | 430.0-900.0 | PVR Treasure Island Mall, South Tukoganj, Indo | AUDI 7 PLAY HOUS | 61 | 0 | 0.0 | 0 | Available |
| Indore | 13:35 | AVAILABLE | 4 | 0 | 360.0-390.0 | INOX Nexus Indore Central, Regal Square, Indor | SCREEN 4 | 258 | 0 | 0.0 | 0 | Available |
| Indore | 14:40 | AVAILABLE | 5 | 0 | 430.0-900.0 | INOX Phoenix Pride of India, Indore | SCREEN 4 | 179 | 0 | 0.0 | 0 | Available |
| Indore | 15:30 | AVAILABLE | 3 | 0 | 440.0-460.0 | Miraj Cinemas : Velocity III, Indore | SCREEN 3 | 200 | 0 | 0.0 | 0 | Available |
| Indore | 17:40 | AVAILABLE | 4 | 0 | 420.0-450.0 | INOX Nexus Indore Central, Regal Square, Indor | SCREEN 4 | 258 | 0 | 0.0 | 0 | Available |
| Indore | 18:40 | AVAILABLE | 2 | 0 | 1070.0-1070.0 | INOX Nexus Indore Central, Regal Square, Indor | INSIGNIA 6 | 37 | 0 | 0.0 | 0 | Available |
| Indore | 18:55 | AVAILABLE | 3 | 0 | 500.0-530.0 | INOX C-21 Mall, Sheetal Nagar, Indore | SCREEN 6 | 173 | 0 | 0.0 | 0 | Available |
| Indore | 19:45 | AVAILABLE | 3 | 0 | 460.0-500.0 | Miraj Cinemas : Velocity III, Indore | SCREEN 3 | 200 | 0 | 0.0 | 0 | Available |
| Indore | 19:55 | AVAILABLE | 6 | 0 | 450.0-940.0 | INOX C-21 Mall, Sheetal Nagar, Indore | SCREEN 4 | 254 | 0 | 0.0 | 0 | Available |
| Indore | 21:00 | AVAILABLE | 3 | 0 | 450.0-940.0 | PVR Treasure Island Mall, South Tukoganj, Indo | AUDI 7 PLAY HOUS | 61 | 0 | 0.0 | 0 | Available |
| Indore | 21:20 | AVAILABLE | 4 | 0 | 450.0-510.0 | INOX Phoenix Pride of India, Indore | SCREEN 2 | 172 | 0 | 0.0 | 0 | Available |
| Indore | 23:45 | AVAILABLE | 6 | 0 | 470.0-920.0 | INOX C-21 Mall, Sheetal Nagar, Indore | SCREEN 4 | 254 | 0 | 0.0 | 0 | Available |
| Indore | 23:55 | AVAILABLE | 3 | 0 | 460.0-500.0 | Miraj Cinemas : Velocity III, Indore | SCREEN 3 | 200 | 0 | 0.0 | 0 | Available |
| Jaipur | 14:05 | AVAILABLE | 4 | 0 | 420.0-460.0 | INOX GT Central Mall, Malviya Nagar, Jaipur | SCREEN 1 | 220 | 0 | 0.0 | 0 | Available |
| Jaipur | 15:35 | AVAILABLE | 4 | 0 | 420.0-460.0 | INOX GT Central Mall, Malviya Nagar, Jaipur | SCREEN 2 | 259 | 0 | 0.0 | 0 | Available |
| Jaipur | 19:10 | AVAILABLE | 1 | 0 | 1020.0-1020.0 | INOX GT Central Mall, Malviya Nagar, Jaipur | INSIGNIA 5 | 30 | 0 | 0.0 | 0 | Available |
| Jaipur | 23:15 | AVAILABLE | 1 | 0 | 1020.0-1020.0 | INOX GT Central Mall, Malviya Nagar, Jaipur | INSIGNIA 5 | 30 | 0 | 0.0 | 0 | Available |
| Jaipur | 23:30 | AVAILABLE | 5 | 0 | 470.0-840.0 | PVR Mall of Jaipur, Vaishali Nagar, Jaipur | AUDI 04 | 162 | 0 | 0.0 | 0 | Available |
| Jalandhar | 08:30 | AVAILABLE | 7 | 0 | 340.0-660.0 | PVR MBD Neopolis Mall, Sehdev Market, Jalandha | AUDI 01 | 176 | 0 | 0.0 | 0 | Available |
| Jalandhar | 09:45 | AVAILABLE | 4 | 0 | 320.0-410.0 | PVR Curo, 66 feet road, Jalandhar | AUDI 04 | 106 | 0 | 0.0 | 0 | Available |
| Jalandhar | 13:50 | AVAILABLE | 4 | 0 | 360.0-450.0 | PVR Curo, 66 feet road, Jalandhar | AUDI 04 | 106 | 0 | 0.0 | 0 | Available |
| Jalandhar | 14:20 | AVAILABLE | 6 | 0 | 370.0-660.0 | PVR Friends, Jalandhar | AUDI 01 | 138 | 0 | 0.0 | 0 | Available |
| Jalandhar | 14:35 | AVAILABLE | 7 | 0 | 380.0-690.0 | PVR MBD Neopolis Mall, Sehdev Market, Jalandha | AUDI 03 | 329 | 0 | 0.0 | 0 | Available |
| Jalandhar | 14:45 | AVAILABLE | 5 | 0 | 390.0-800.0 | INOX Jalandhar Reliance Mall, Reliance Mall, J | SCREEN 3 | 265 | 0 | 0.0 | 0 | Available |
| Jalandhar | 17:55 | AVAILABLE | 4 | 0 | 360.0-450.0 | PVR Curo, 66 feet road, Jalandhar | AUDI 04 | 106 | 0 | 0.0 | 0 | Available |
| Jalandhar | 18:25 | AVAILABLE | 6 | 0 | 390.0-700.0 | PVR Friends, Jalandhar | AUDI 01 | 138 | 0 | 0.0 | 0 | Available |
| Jalandhar | 20:45 | AVAILABLE | 7 | 0 | 400.0-730.0 | PVR MBD Neopolis Mall, Sehdev Market, Jalandha | AUDI 01 | 176 | 0 | 0.0 | 0 | Available |
| Jalandhar | 22:00 | AVAILABLE | 4 | 0 | 380.0-470.0 | PVR Curo, 66 feet road, Jalandhar | AUDI 04 | 106 | 0 | 0.0 | 0 | Available |
| Jalandhar | 22:30 | AVAILABLE | 6 | 0 | 390.0-700.0 | PVR Friends, Jalandhar | AUDI 01 | 138 | 0 | 0.0 | 0 | Available |
| Jalandhar | 22:45 | AVAILABLE | 7 | 0 | 400.0-730.0 | PVR MBD Neopolis Mall, Sehdev Market, Jalandha | AUDI 03 | 329 | 0 | 0.0 | 0 | Available |
| Jalandhar | 22:55 | AVAILABLE | 5 | 0 | 410.0-820.0 | INOX Jalandhar Reliance Mall, Reliance Mall, J | SCREEN 3 | 265 | 0 | 0.0 | 0 | Available |
| Jamshedpur | 12:00 | AVAILABLE | 4 | 0 | 280.0-430.0 | Miraj Cinemas : Chandra Pacific Mall, Golmuri | SCREEN2 | 272 | 0 | 0.0 | 0 | Available |
| Kolkata | 09:40 | AVAILABLE | 1 | 0 | 830.0-830.0 | INOX Quest Mall, Ballygunge, Kolkata | SCREEN 5 | 77 | 0 | 0.0 | 0 | Available |
| Kolkata | 13:45 | AVAILABLE | 1 | 0 | 1820.0-1820.0 | INOX Quest Mall, Ballygunge, Kolkata | SCREEN 5 | 77 | 0 | 0.0 | 0 | Available |
| Lucknow | 09:15 | AVAILABLE | 3 | 0 | 400.0-400.0 | INOX Megaplex Emerald, Ashiyana, Lucknow | SCREEN 4 | 164 | 0 | 0.0 | 0 | Available |
| Lucknow | 09:45 | AVAILABLE | 4 | 0 | 400.0-620.0 | PVR SUPERPLEX Lulu, Lulu Mall, Lucknow | AUDI 02 | 254 | 0 | 0.0 | 0 | Available |
| Lucknow | 13:05 | AVAILABLE | 4 | 0 | 310.0-560.0 | INOX Umrao Mall, Mahanagar, Lucknow | SCREEN 3 | 202 | 0 | 0.0 | 0 | Available |
| Lucknow | 13:20 | AVAILABLE | 3 | 0 | 450.0-450.0 | INOX Megaplex Emerald, Ashiyana, Lucknow | SCREEN 4 | 164 | 0 | 0.0 | 0 | Available |
| Lucknow | 17:25 | AVAILABLE | 3 | 0 | 450.0-450.0 | INOX Megaplex Emerald, Ashiyana, Lucknow | SCREEN 4 | 164 | 0 | 0.0 | 0 | Available |
| Lucknow | 18:25 | AVAILABLE | 4 | 0 | 450.0-750.0 | INOX Megaplex Emerald, Ashiyana, Lucknow | SCREEN 3 | 241 | 0 | 0.0 | 0 | Available |
| Lucknow | 21:15 | AVAILABLE | 4 | 0 | 310.0-560.0 | INOX Umrao Mall, Mahanagar, Lucknow | SCREEN 3 | 202 | 0 | 0.0 | 0 | Available |
| Lucknow | 22:30 | AVAILABLE | 4 | 0 | 450.0-750.0 | INOX Megaplex Emerald, Ashiyana, Lucknow | SCREEN 3 | 241 | 0 | 0.0 | 0 | Available |
| Lucknow | 23:15 | AVAILABLE | 3 | 0 | 450.0-600.0 | PVR Phoenix United Mall, Alambagh, Lucknow | AUDI 02 | 382 | 0 | 0.0 | 0 | Available |
| Lucknow | 23:45 | AVAILABLE | 4 | 0 | 450.0-850.0 | INOX Megaplex Phoenix Palassio Mall, Amar Sahe | SCREEN 7 | 203 | 0 | 0.0 | 0 | Available |
| Ludhiana | 09:25 | AVAILABLE | 6 | 0 | 270.0-370.0 | PVR Silver Arc Mall, Gurdev Nagar, Ludhiana | AUDI 01 | 270 | 0 | 0.0 | 0 | Available |
| Ludhiana | 10:00 | AVAILABLE | 3 | 0 | 260.0-540.0 | PVR Avon City Mall, Gurdev Nagar, Ludhiana | AUDI 04 | 163 | 0 | 0.0 | 0 | Available |
| Ludhiana | 12:10 | AVAILABLE | 5 | 0 | 350.0-600.0 | PVR Silver Arc Mall, Gurdev Nagar, Ludhiana | AUDI 05 | 139 | 0 | 0.0 | 0 | Available |
| Ludhiana | 13:30 | AVAILABLE | 6 | 0 | 350.0-460.0 | PVR Silver Arc Mall, Gurdev Nagar, Ludhiana | AUDI 01 | 270 | 0 | 0.0 | 0 | Available |
| Ludhiana | 16:15 | AVAILABLE | 5 | 0 | 350.0-600.0 | PVR Silver Arc Mall, Gurdev Nagar, Ludhiana | AUDI 05 | 139 | 0 | 0.0 | 0 | Available |
| Ludhiana | 18:10 | AVAILABLE | 3 | 0 | 370.0-610.0 | PVR Avon City Mall, Gurdev Nagar, Ludhiana | AUDI 04 | 163 | 0 | 0.0 | 0 | Available |
| Ludhiana | 21:40 | AVAILABLE | 6 | 0 | 370.0-480.0 | PVR Silver Arc Mall, Gurdev Nagar, Ludhiana | AUDI 01 | 270 | 0 | 0.0 | 0 | Available |
| Ludhiana | 22:15 | AVAILABLE | 3 | 0 | 350.0-590.0 | PVR Avon City Mall, Gurdev Nagar, Ludhiana | AUDI 04 | 163 | 0 | 0.0 | 0 | Available |
| Mumbai | 06:40 | AVAILABLE | 4 | 0 | 400.0-540.0 | PVR Lido, Santacruz (W), Mumbai | SCREEN 3 | 165 | 0 | 0.0 | 0 | Available |
| Mumbai | 07:20 | AVAILABLE | 2 | 0 | 610.0-660.0 | PVR Market City, Kurla(W), Mumbai | AUDI 02 | 72 | 0 | 0.0 | 0 | Available |
| Mumbai | 07:40 | AVAILABLE | 3 | 0 | 350.0-370.0 | PVR Lido, Santacruz (W), Mumbai | SCREEN 2 | 56 | 0 | 0.0 | 0 | Available |
| Mumbai | 10:10 | AVAILABLE | 2 | 0 | 620.0-670.0 | INOX Laserplex CR2, Nariman Point, Mumbai | SCREEN 2 | 67 | 0 | 0.0 | 0 | Available |
| Mumbai | 10:35 | AVAILABLE | 5 | 0 | 330.0-580.0 | PVR Infiniti Malad, Malad (W), Mumbai | SCREEN 2 | 237 | 0 | 0.0 | 0 | Available |
| Mumbai | 13:20 | AVAILABLE | 2 | 0 | 1770.0-1840.0 | INOX Megaplex, Inorbit Mall Malad, Mumbai | INSIGNIA 10 | 42 | 0 | 0.0 | 0 | Available |
| Mumbai | 14:05 | AVAILABLE | 2 | 0 | 1750.0-1850.0 | INOX Megaplex, Oberoi Sky City Mall, Mumbai | SCREEN 1 | 38 | 0 | 0.0 | 0 | Available |
| Mumbai | 14:15 | AVAILABLE | 2 | 0 | 1800.0-1850.0 | INOX Laserplex CR2, Nariman Point, Mumbai | SCREEN 2 | 67 | 0 | 0.0 | 0 | Available |
| Mumbai | 15:40 | AVAILABLE | 4 | 0 | 530.0-1080.0 | PVR Infiniti Malad, Malad (W), Mumbai | SCREEN 3 | 163 | 0 | 0.0 | 0 | Available |
| Mumbai | 17:25 | AVAILABLE | 2 | 0 | 1770.0-1840.0 | INOX Megaplex, Inorbit Mall Malad, Mumbai | INSIGNIA 10 | 42 | 0 | 0.0 | 0 | Available |
| Mumbai | 18:20 | AVAILABLE | 2 | 0 | 1900.0-1950.0 | INOX Laserplex CR2, Nariman Point, Mumbai | SCREEN 2 | 67 | 0 | 0.0 | 0 | Available |
| Mumbai | 22:15 | AVAILABLE | 2 | 0 | 1850.0-1950.0 | INOX Megaplex, Oberoi Sky City Mall, Mumbai | SCREEN 1 | 38 | 0 | 0.0 | 0 | Available |
| Mumbai | 22:25 | AVAILABLE | 2 | 0 | 1900.0-1950.0 | INOX Laserplex CR2, Nariman Point, Mumbai | SCREEN 2 | 67 | 0 | 0.0 | 0 | Available |
| Mumbai | 22:50 | AVAILABLE | 5 | 0 | 530.0-1080.0 | PVR Infiniti Malad, Malad (W), Mumbai | SCREEN 2 | 237 | 0 | 0.0 | 0 | Available |
| Mumbai | 23:50 | AVAILABLE | 4 | 0 | 530.0-1080.0 | PVR Infiniti Malad, Malad (W), Mumbai | SCREEN 3 | 163 | 0 | 0.0 | 0 | Available |
| Nagpur | 13:55 | AVAILABLE | 4 | 0 | 350.0-420.0 | INOX Jaswant Tuli Mall, Kamptee Road, Nagpur | SCREEN 4 | 273 | 0 | 0.0 | 0 | Available |
| Nagpur | 18:00 | AVAILABLE | 4 | 0 | 370.0-440.0 | INOX Jaswant Tuli Mall, Kamptee Road, Nagpur | SCREEN 4 | 273 | 0 | 0.0 | 0 | Available |
| Raipur | 09:50 | AVAILABLE | 5 | 0 | 280.0-500.0 | PVR Magneto The Mall, Magneto Mall, Raipur | AUDI 03 | 225 | 0 | 0.0 | 0 | Available |
| Raipur | 14:10 | AVAILABLE | 3 | 0 | 320.0-600.0 | Miraj Cinemas : CBD, Nava Raipur | SCREEN 1 | 151 | 0 | 0.0 | 0 | Available |
| Raipur | 14:50 | AVAILABLE | 5 | 0 | 310.0-600.0 | INOX Ambuja City Centre, Mowa, Raipur | SCREEN 1 | 197 | 0 | 0.0 | 0 | Available |
| Raipur | 15:35 | AVAILABLE | 4 | 0 | 320.0-600.0 | Miraj Cinemas : CBD, Nava Raipur | SCREEN 2 | 117 | 0 | 0.0 | 0 | Available |
| Raipur | 18:05 | AVAILABLE | 3 | 0 | 320.0-620.0 | Miraj Cinemas : CBD, Nava Raipur | SCREEN 1 | 151 | 0 | 0.0 | 0 | Available |
| Raipur | 19:30 | AVAILABLE | 4 | 0 | 320.0-620.0 | Miraj Cinemas : CBD, Nava Raipur | SCREEN 2 | 117 | 0 | 0.0 | 0 | Available |
| Raipur | 22:00 | AVAILABLE | 3 | 0 | 320.0-620.0 | Miraj Cinemas : CBD, Nava Raipur | SCREEN 1 | 151 | 0 | 0.0 | 0 | Available |
| Raipur | 23:00 | AVAILABLE | 5 | 0 | 320.0-610.0 | INOX Ambuja City Centre, Mowa, Raipur | SCREEN 1 | 197 | 0 | 0.0 | 0 | Available |
| Raipur | 23:25 | AVAILABLE | 4 | 0 | 320.0-620.0 | Miraj Cinemas : CBD, Nava Raipur | SCREEN 2 | 117 | 0 | 0.0 | 0 | Available |
| Rajkot | 18:55 | AVAILABLE | 3 | 0 | 430.0-450.0 | INOX R World, Kasturba Road, Rajkot | SCREEN 3 | 232 | 0 | 0.0 | 0 | Available |
| Ranchi | 19:50 | AVAILABLE | 3 | 0 | 380.0-380.0 | Miraj Cinemas : Sandhya Tower, Ranchi | SCREEN 2 | 334 | 0 | 0.0 | 0 | Available |
| Ranchi | 23:45 | AVAILABLE | 3 | 0 | 380.0-380.0 | Miraj Cinemas : Sandhya Tower, Ranchi | SCREEN 2 | 334 | 0 | 0.0 | 0 | Available |
| Siliguri | 07:00 | AVAILABLE | 3 | 0 | 280.0-440.0 | INOX City Centre, Matigara, Siliguri | SCREEN 2 | 218 | 0 | 0.0 | 0 | Available |
| Siliguri | 22:55 | AVAILABLE | 3 | 0 | 280.0-440.0 | INOX City Centre, Matigara, Siliguri | SCREEN 2 | 218 | 0 | 0.0 | 0 | Available |
| Surat | 07:20 | AVAILABLE | 5 | 0 | 270.0-510.0 | INOX Reliance Mega Mall, Udhna, Surat | SCREEN 3 | 205 | 0 | 0.0 | 0 | Available |
| Surat | 07:30 | AVAILABLE | 2 | 0 | 550.0-550.0 | INOX VR Surat, Dumas Road, Surat | SCREEN 1 | 52 | 0 | 0.0 | 0 | Available |
| Surat | 08:15 | AVAILABLE | 4 | 0 | 210.0-420.0 | Miraj Cinemas : KSB Mall, Surat | SCREEN 3 | 231 | 0 | 0.0 | 0 | Available |
| Surat | 08:45 | AVAILABLE | 5 | 0 | 290.0-490.0 | INOX VR Surat, Dumas Road, Surat | SCREEN 7 | 251 | 0 | 0.0 | 0 | Available |
| Surat | 09:15 | AVAILABLE | 4 | 0 | 210.0-420.0 | Miraj Cinemas : KSB Mall, Surat | SCREEN 1 | 231 | 0 | 0.0 | 0 | Available |
| Surat | 09:30 | AVAILABLE | 4 | 0 | 270.0-460.0 | PVR Rahul Raj Mall, Dumas Road, Surat | AUDI 06 | 153 | 0 | 0.0 | 0 | Available |
| Surat | 10:30 | AVAILABLE | 4 | 0 | 270.0-460.0 | PVR Rahul Raj Mall, Dumas Road, Surat | AUDI 03 | 155 | 0 | 0.0 | 0 | Available |
| Surat | 10:45 | AVAILABLE | 5 | 0 | 290.0-490.0 | INOX VR Surat, Dumas Road, Surat | SCREEN 6 | 251 | 0 | 0.0 | 0 | Available |
| Surat | 11:15 | AVAILABLE | 2 | 0 | 550.0-550.0 | INOX VR Surat, Dumas Road, Surat | SCREEN 1 | 52 | 0 | 0.0 | 0 | Available |
| Surat | 11:45 | AVAILABLE | 4 | 0 | 290.0-490.0 | INOX VR Surat, Dumas Road, Surat | SCREEN 5 | 194 | 0 | 0.0 | 0 | Available |
| Surat | 12:30 | AVAILABLE | 4 | 0 | 300.0-600.0 | Miraj Cinemas : KSB Mall, Surat | SCREEN 3 | 231 | 0 | 0.0 | 0 | Available |
| Surat | 13:30 | AVAILABLE | 4 | 0 | 300.0-600.0 | Miraj Cinemas : KSB Mall, Surat | SCREEN 1 | 231 | 0 | 0.0 | 0 | Available |
| Surat | 13:35 | AVAILABLE | 4 | 0 | 360.0-620.0 | PVR Rahul Raj Mall, Dumas Road, Surat | AUDI 06 | 153 | 0 | 0.0 | 0 | Available |
| Surat | 14:30 | AVAILABLE | 4 | 0 | 340.0-640.0 | Miraj Cinemas : KSB Mall, Surat | SCREEN 2 | 231 | 0 | 0.0 | 0 | Available |
| Surat | 14:35 | AVAILABLE | 4 | 0 | 360.0-620.0 | PVR Rahul Raj Mall, Dumas Road, Surat | AUDI 03 | 155 | 0 | 0.0 | 0 | Available |
| Surat | 15:20 | AVAILABLE | 2 | 0 | 700.0-700.0 | INOX VR Surat, Dumas Road, Surat | SCREEN 1 | 52 | 0 | 0.0 | 0 | Available |
| Surat | 15:35 | AVAILABLE | 4 | 0 | 410.0-650.0 | PVR Rahul Raj Mall, Dumas Road, Surat | AUDI 08 | 154 | 0 | 0.0 | 0 | Available |
| Surat | 16:45 | AVAILABLE | 4 | 0 | 300.0-600.0 | Miraj Cinemas : KSB Mall, Surat | SCREEN 3 | 231 | 0 | 0.0 | 0 | Available |
| Surat | 17:40 | AVAILABLE | 4 | 0 | 360.0-620.0 | PVR Rahul Raj Mall, Dumas Road, Surat | AUDI 06 | 153 | 0 | 0.0 | 0 | Available |
| Surat | 18:40 | AVAILABLE | 4 | 0 | 380.0-660.0 | PVR Rahul Raj Mall, Dumas Road, Surat | AUDI 03 | 155 | 0 | 0.0 | 0 | Available |
| Surat | 18:45 | AVAILABLE | 4 | 0 | 360.0-660.0 | Miraj Cinemas : KSB Mall, Surat | SCREEN 2 | 231 | 0 | 0.0 | 0 | Available |
| Surat | 22:45 | AVAILABLE | 4 | 0 | 380.0-660.0 | PVR Rahul Raj Mall, Dumas Road, Surat | AUDI 03 | 155 | 0 | 0.0 | 0 | Available |
| Surat | 23:30 | AVAILABLE | 2 | 0 | 800.0-800.0 | INOX VR Surat, Dumas Road, Surat | SCREEN 1 | 52 | 0 | 0.0 | 0 | Available |
| Vadodara | 07:20 | AVAILABLE | 4 | 0 | 240.0-420.0 | INOX Reliance Mega Mall, Old Padra Road, Vadod | SCREEN 3 | 228 | 0 | 0.0 | 0 | Available |
| Vadodara | 09:30 | AVAILABLE | 4 | 0 | 250.0-290.0 | PVR EVA Mall, Manjalpur, Vadodara | AUDI 02 | 177 | 0 | 0.0 | 0 | Available |
| Vadodara | 13:35 | AVAILABLE | 4 | 0 | 370.0-410.0 | PVR EVA Mall, Manjalpur, Vadodara | AUDI 02 | 177 | 0 | 0.0 | 0 | Available |
| Vadodara | 17:40 | AVAILABLE | 4 | 0 | 370.0-410.0 | PVR EVA Mall, Manjalpur, Vadodara | AUDI 02 | 177 | 0 | 0.0 | 0 | Available |
| Vadodara | 23:15 | AVAILABLE | 4 | 0 | 340.0-570.0 | INOX Reliance Mega Mall, Old Padra Road, Vadod | SCREEN 3 | 228 | 0 | 0.0 | 0 | Available |
| Rajkot | 15:20 | NONE | 0 | 0 | n/a | INOX Reliance Mega Mall, Reliance Mall, Rajkot | SCREEN 2 | 133 | 7 | 5.3 | 3,220 | Available |
| Rajkot | 19:25 | NONE | 0 | 0 | n/a | INOX Reliance Mega Mall, Reliance Mall, Rajkot | SCREEN 2 | 133 | 6 | 4.5 | 2,760 | Available |
| Rajkot | 23:30 | NONE | 0 | 0 | n/a | INOX Reliance Mega Mall, Reliance Mall, Rajkot | SCREEN 2 | 133 | 6 | 4.5 | 2,680 | Available |
| Rajkot | 11:15 | NONE | 0 | 0 | n/a | INOX Reliance Mega Mall, Reliance Mall, Rajkot | SCREEN 2 | 133 | 5 | 3.8 | 1,900 | Available |
| Rajkot | 07:35 | NONE | 0 | 0 | n/a | INOX Reliance Mega Mall, Reliance Mall, Rajkot | SCREEN 2 | 133 | 0 | 0.0 | 0 | Available |

### D3. The n-to-m buckets - same city and minute, several rooms each side

Not clean pairs, but not worthless: where every BookMyShow showtime in the
bucket carries the same label, the District occupancies in that bucket still
bound what that label can mean. Buckets where the labels disagree are shown
too, flagged `mixed`.

| city | time | D shows | B shows | BMS labels | D occ range | D occ mean | D cap range | D tickets |
|---|---|---|---|---|---|---|---|---|
| Mumbai | 07:00 | 20 | 25 | mixed: AVAILABLE x21, FILLING FAST x2, ALMOST FULL x2 | 0.0-48.6 | 10.1 | 153-497 | 691 |
| Mumbai | 18:55 | 13 | 15 | mixed: AVAILABLE x12, ALMOST FULL x1, FILLING FAST x1, SOLD OUT x1 | 0.0-51.3 | 11.9 | 194-497 | 602 |
| Delhi-NCR | 19:50 | 12 | 13 | mixed: AVAILABLE x7, FILLING FAST x3, ALMOST FULL x3 | 0.0-55.8 | 16.5 | 106-380 | 583 |
| Mumbai | 23:00 | 17 | 22 | mixed: AVAILABLE x17, FILLING FAST x3, SOLD OUT x1, ALMOST FULL x1 | 0.0-23.5 | 9.7 | 162-497 | 538 |
| Delhi-NCR | 19:40 | 13 | 13 | mixed: AVAILABLE x10, FILLING FAST x2, SOLD OUT x1 | 0.0-65.1 | 12.3 | 55-386 | 507 |
| Delhi-NCR | 15:35 | 6 | 6 | mixed: AVAILABLE x4, SOLD OUT x2 | 0.0-63.2 | 23.0 | 202-386 | 453 |
| Delhi-NCR | 11:30 | 6 | 6 | mixed: AVAILABLE x3, SOLD OUT x1, FILLING FAST x1, ALMOST FULL x1 | 1.1-62.0 | 22.4 | 202-386 | 442 |
| Delhi-NCR | 11:40 | 12 | 13 | mixed: AVAILABLE x10, FILLING FAST x3 | 0.0-47.3 | 11.2 | 106-380 | 433 |
| Bengaluru | 10:00 | 1 | 2 | mixed: AVAILABLE x1, FILLING FAST x1 | 81.8-81.8 | 81.8 | 527-527 | 431 |
| Mumbai | 10:45 | 13 | 15 | mixed: AVAILABLE x12, FILLING FAST x3 | 0.0-30.5 | 8.3 | 194-497 | 410 |
| Delhi-NCR | 08:00 | 12 | 13 | mixed: AVAILABLE x10, FILLING FAST x2, ALMOST FULL x1 | 0.0-47.6 | 11.8 | 43-380 | 407 |
| Delhi-NCR | 11:00 | 9 | 9 | mixed: AVAILABLE x6, FILLING FAST x2, SOLD OUT x1 | 0.0-75.1 | 11.6 | 35-423 | 375 |
| Delhi-NCR | 15:05 | 21 | 21 | mixed: AVAILABLE x19, FILLING FAST x1, SOLD OUT x1 | 0.0-61.9 | 5.8 | 35-442 | 374 |
| Delhi-NCR | 23:45 | 6 | 6 | mixed: AVAILABLE x4, FILLING FAST x2 | 0.0-41.0 | 18.0 | 202-386 | 355 |
| Kolkata | 10:40 | 10 | 10 | mixed: AVAILABLE x9, SOLD OUT x1 | 0.0-72.1 | 12.1 | 147-414 | 354 |
| Delhi-NCR | 19:10 | 8 | 8 | mixed: AVAILABLE x4, FILLING FAST x3, ALMOST FULL x1 | 0.8-55.4 | 14.8 | 35-423 | 344 |
| Kolkata | 07:00 | 12 | 12 | mixed: AVAILABLE x11, SOLD OUT x1 | 0.0-68.0 | 8.5 | 147-414 | 306 |
| Mumbai | 14:50 | 13 | 15 | mixed: AVAILABLE x12, FILLING FAST x3 | 0.0-30.8 | 5.9 | 194-497 | 297 |
| Delhi-NCR | 18:40 | 4 | 2 | mixed: AVAILABLE x1, ALMOST FULL x1 | 5.5-64.9 | 23.8 | 110-388 | 294 |
| Delhi-NCR | 10:30 | 3 | 1 | SOLD OUT x1 | 10.3-64.4 | 31.1 | 140-388 | 292 |
| Mumbai | 14:30 | 5 | 7 | mixed: AVAILABLE x5, FILLING FAST x1, SOLD OUT x1 | 14.2-22.3 | 17.5 | 162-471 | 292 |
| Delhi-NCR | 07:20 | 3 | 3 | mixed: AVAILABLE x2, SOLD OUT x1 | 0.6-73.8 | 25.7 | 299-381 | 291 |
| Delhi-NCR | 22:45 | 5 | 2 | mixed: AVAILABLE x1, SOLD OUT x1 | 3.8-59.5 | 20.4 | 104-388 | 291 |
| Delhi-NCR | 15:45 | 12 | 13 | mixed: AVAILABLE x11, SOLD OUT x1, ALMOST FULL x1 | 0.0-48.6 | 8.0 | 106-380 | 290 |
| Kolkata | 11:40 | 12 | 13 | mixed: AVAILABLE x11, FILLING FAST x2 | 0.0-30.4 | 7.5 | 176-414 | 284 |
| Delhi-NCR | 09:00 | 20 | 20 | mixed: AVAILABLE x17, FILLING FAST x3 | 0.0-34.3 | 6.4 | 74-271 | 271 |
| Delhi-NCR | 14:35 | 3 | 1 | ALMOST FULL x1 | 8.3-59.8 | 28.9 | 140-388 | 271 |
| Kolkata | 15:45 | 12 | 13 | mixed: AVAILABLE x12, FILLING FAST x1 | 0.0-30.2 | 6.4 | 176-414 | 265 |
| Mumbai | 10:15 | 6 | 9 | mixed: AVAILABLE x8, FILLING FAST x1 | 0.0-21.4 | 13.0 | 42-471 | 265 |
| Mumbai | 22:00 | 12 | 14 | mixed: AVAILABLE x12, SOLD OUT x2 | 0.0-21.8 | 8.3 | 132-394 | 243 |
| Kolkata | 18:50 | 10 | 10 | mixed: AVAILABLE x7, FILLING FAST x2, SOLD OUT x1 | 0.0-51.6 | 9.0 | 147-414 | 236 |
| Kolkata | 14:45 | 10 | 10 | mixed: AVAILABLE x8, FILLING FAST x1, SOLD OUT x1 | 0.0-49.8 | 8.4 | 147-414 | 222 |
| Delhi-NCR | 18:45 | 9 | 9 | mixed: AVAILABLE x8, ALMOST FULL x1 | 0.0-49.8 | 5.8 | 27-448 | 215 |
| Pune | 07:00 | 13 | 12 | mixed: AVAILABLE x10, FILLING FAST x2 | 0.0-22.6 | 6.6 | 54-429 | 215 |
| Bhubaneswar | 08:00 | 5 | 5 | mixed: FILLING FAST x2, AVAILABLE x2, ALMOST FULL x1 | 1.4-35.6 | 15.7 | 131-497 | 211 |
| Mumbai | 18:45 | 5 | 7 | mixed: AVAILABLE x5, FILLING FAST x1, SOLD OUT x1 | 0.8-21.6 | 15.0 | 162-457 | 211 |
| Mumbai | 19:55 | 11 | 12 | mixed: AVAILABLE x10, FILLING FAST x2 | 1.2-23.1 | 8.5 | 134-523 | 204 |
| Pune | 19:55 | 6 | 6 | mixed: AVAILABLE x4, FILLING FAST x1, ALMOST FULL x1 | 0.0-47.8 | 11.2 | 170-375 | 202 |
| Delhi-NCR | 21:15 | 9 | 9 | mixed: AVAILABLE x8, ALMOST FULL x1 | 0.0-38.4 | 10.0 | 103-271 | 198 |
| Delhi-NCR | 17:10 | 9 | 9 | mixed: AVAILABLE x7, FILLING FAST x2 | 0.0-34.3 | 9.4 | 103-271 | 191 |
| Delhi-NCR | 23:15 | 8 | 8 | mixed: AVAILABLE x6, FILLING FAST x1, ALMOST FULL x1 | 0.0-46.5 | 6.2 | 35-415 | 184 |
| Mumbai | 19:40 | 5 | 9 | mixed: AVAILABLE x6, FILLING FAST x2, ALMOST FULL x1 | 0.0-36.0 | 13.0 | 56-311 | 181 |
| Pune | 08:00 | 8 | 8 | mixed: AVAILABLE x7, ALMOST FULL x1 | 0.0-46.9 | 7.2 | 170-375 | 177 |
| Delhi-NCR | 19:20 | 13 | 13 | mixed: AVAILABLE x12, FILLING FAST x1 | 2.0-10.5 | 6.3 | 132-442 | 175 |
| Mumbai | 17:45 | 4 | 6 | mixed: AVAILABLE x4, SOLD OUT x1, FILLING FAST x1 | 14.5-17.8 | 16.7 | 142-324 | 174 |
| Mumbai | 13:30 | 4 | 6 | mixed: AVAILABLE x4, SOLD OUT x1, FILLING FAST x1 | 14.5-17.6 | 16.6 | 142-324 | 173 |
| Kolkata | 19:50 | 12 | 13 | mixed: AVAILABLE x12, ALMOST FULL x1 | 0.0-30.0 | 3.9 | 176-414 | 171 |
| Mumbai | 19:25 | 5 | 5 | mixed: AVAILABLE x3, FILLING FAST x2 | 0.0-38.6 | 16.0 | 31-370 | 160 |
| Delhi-NCR | 07:00 | 14 | 14 | mixed: AVAILABLE x13, FILLING FAST x1 | 0.0-30.0 | 4.6 | 55-353 | 159 |
| Delhi-NCR | 21:45 | 13 | 12 | mixed: AVAILABLE x11, ALMOST FULL x1 | 0.0-24.0 | 6.5 | 55-306 | 159 |
| Delhi-NCR | 06:55 | 3 | 3 | mixed: AVAILABLE x2, ALMOST FULL x1 | 0.0-38.3 | 12.9 | 196-410 | 158 |
| Bhubaneswar | 11:40 | 4 | 4 | mixed: FILLING FAST x2, AVAILABLE x2 | 3.4-38.4 | 14.0 | 250-438 | 156 |
| Jaipur | 23:55 | 4 | 4 | mixed: AVAILABLE x2, FILLING FAST x1, SOLD OUT x1 | 0.9-24.5 | 9.3 | 232-478 | 152 |
| Mumbai | 08:00 | 16 | 19 | mixed: AVAILABLE x16, FILLING FAST x3 | 0.0-8.6 | 3.7 | 99-469 | 152 |
| Delhi-NCR | 13:05 | 9 | 9 | mixed: AVAILABLE x7, FILLING FAST x2 | 0.0-34.3 | 7.1 | 103-271 | 150 |
| Jaipur | 07:00 | 3 | 2 | mixed: ALMOST FULL x1, AVAILABLE x1 | 16.7-34.3 | 25.9 | 35-478 | 150 |
| Patna | 10:50 | 2 | 2 | AVAILABLE x2 | 20.3-38.5 | 29.4 | 246-260 | 150 |
| Delhi-NCR | 10:50 | 13 | 13 | AVAILABLE x13 | 1.8-14.4 | 5.1 | 132-442 | 141 |
| Jaipur | 19:40 | 2 | 2 | mixed: FILLING FAST x1, AVAILABLE x1 | 1.5-27.6 | 14.6 | 259-478 | 136 |
| Delhi-NCR | 10:40 | 7 | 7 | mixed: AVAILABLE x5, FILLING FAST x2 | 0.0-23.1 | 6.3 | 148-352 | 133 |

(Top 60 buckets by District tickets; 506 buckets in total.)

### D4. What the pairing does and does not establish

- A matched minute is not a matched room. Two cinemas in the same city can
  start at the same minute; the one-to-one filter makes that unlikely in the
  D1/D2 set but does not make it impossible.
- BookMyShow's `worstLabel` is the most-full seat class in that showtime, not
  the showtime overall. A show with a 20-seat recliner class sold out and a
  200-seat main floor empty reads SOLD OUT. `nCat` and `soldOutCats` in D2
  are there so that can be allowed for.
- Occupancy here is District's occupancy, which still contains house blocks.
  See Section E for the block figures and how they were separated.

---

## E. CONSTRAINTS, THE DOUBLE COUNT, AND A WORKED NAIVE ESTIMATE

### E1. What is genuinely missing

1. **No BookMyShow capacity, anywhere.** Capacity exists only inside the
   booking funnel, which is past seat selection and therefore off limits -
   we read public pages only, never a booking path. So every BookMyShow
   ticket number is capacity multiplied by something, and the capacity half
   is an assumption. District's capacity distribution (Section A1, median
   211) is the only reference, and BookMyShow reaches single screens larger
   than anything in District's set.
2. **No venue identity.** `venueCode` and `venueName` came back empty on all
   2,751 rows. This is a bug of ours, not a change at BookMyShow - the raw
   payloads are saved and will be re-parsed. Until then nothing can be
   deduped at cinema level.
3. **`worstLabel` is a seat class, not a show.** A showtime reads SOLD OUT
   when its most-full class is gone. A 24-seat recliner tier selling out in a
   240-seat room produces SOLD OUT at 10% occupancy. The D1 ladder shows this
   directly: paired SOLD OUT showtimes run a median 25.4% full, not 95%.

### E2. The double count, which is the real blocker

District and BookMyShow sell tickets for THE SAME CINEMAS. PVR INOX is 71%
of District's showtimes and is sold on BookMyShow as well. Adding a
BookMyShow estimate to District's 46,539 tickets would count a large share
of the same seats twice.

The showtime pairing in Section D puts a floor under how large that overlap
is: 2651 of BookMyShow's 2,751 showtimes fall in a (city, minute) bucket that
District also lists. That is 96% of BookMyShow's footprint sitting on top
of District's, before venue identity is even available to check it properly.

So the useful question is almost certainly not "how many tickets has
BookMyShow sold" but one of these:

- **(a)** How many tickets are on BookMyShow that are NOT on District -
  i.e. the incremental Indian total, which is what a worldwide figure needs.
- **(b)** Does BookMyShow's label distribution imply District's 7.01%
  national occupancy is right, too low, or too high? A cross-check is worth
  more than a second total.

Breakdown that bears on (a) - BookMyShow showtimes by whether District sees
that city at all:

| label | BMS shows in District cities | BMS shows in cities District does not list |
|---|---|---|
| SOLD OUT | 63 | 7 |
| ALMOST FULL | 68 | 0 |
| FILLING FAST | 261 | 1 |
| AVAILABLE | 2306 | 4 |
| NONE | 37 | 4 |
| **total** | **2735** | **16** |

### E3. A worked naive estimate, with the error bars left on

Method: take the D1 ladder (mean occupancy and mean capacity per label, from
the 597 one-to-one pairs), apply it to BookMyShow's national label mix, and
do not dedupe. This is the arithmetic a model would do first, written out so
it can be argued with.

| label | BMS shows | ladder mean occ% | ladder mean cap | implied tickets |
|---|---|---|---|---|
| SOLD OUT | 70 | 26.0 | 184 | 3,350 |
| ALMOST FULL | 68 | 27.6 | 255 | 4,786 |
| FILLING FAST | 262 | 16.6 | 239 | 10,411 |
| AVAILABLE | 2310 | 4.3 | 200 | 19,812 |
| NONE | 41 | 3.6 | 133 | 197 |
| **total** | **2751** | | | **38,556** |

That lands at about 39,000 tickets. Three reasons not to publish it:

- it double-counts District wholesale (see E2);
- the two labels carrying the most tickets per show, SOLD OUT and ALMOST
  FULL, rest on 25 and 21 observations;
- capacity comes from District's rooms, and BookMyShow's room mix is not
  District's room mix.

### E4. The earlier sensitivity grid, for comparison

Before the showtime pairing existed, the same question was approached by
assuming an occupancy per label and a flat capacity. Varying those
assumptions across plausible ranges produced **11,967 to 242,088 tickets, a
20x spread**. That grid is why no BookMyShow number has been published.

The pairing in Section D is what narrows it, and it is new as of this file.

### E5. What would be most useful back

In rough order of value:

1. **A defensible occupancy per BookMyShow label**, with an interval, built
   from the D2 pairs - and a view on whether `nCat` and `soldOutCats` should
   be in that model rather than the label alone. A SOLD OUT showtime with 2
   of 2 classes gone is a different animal from 1 of 6.
2. **An incremental estimate**: tickets on BookMyShow that District does not
   already count. The city split in E2 and the bucket overlap in D3 are the
   inputs. This is the number that would actually change a published total.
3. **A verdict on District's 7.01%**. If BookMyShow's label mix implies
   something materially different, that is a finding in its own right and
   more valuable than any estimate.
4. **A capacity prior for BookMyShow rooms** that is not simply District's
   distribution, if one can be justified.

Things that would not help: a single point estimate with no interval; an
estimate that assumes SOLD OUT means a full room (D1 says it does not); or a
BookMyShow total presented as additive to District's.
