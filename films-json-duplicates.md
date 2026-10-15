# films.json — duplicate and colliding rows

1,104 rows. 71 pageUrl slugs are claimed by more than one row, covering 156 rows.
These are **not** missing pages. They are rows filed under the wrong year.

## A · Same film, wrong year — delete the surplus rows

59 slugs. The row whose bucket matches its own `releaseDate` is correct; the others are copies.

| page | keep in | delete from | title | releaseDate |
|---|---|---|---|---|
| `2018-everyone-is-a-hero-box-office.html` | **2023** | 2022 | 2018: Everyone Is a Hero | May 5, 2023 |
| `aadhavan-box-office.html` | **2009** | 2008 | Aadhavan | 2009 |
| `ala-vaikunthapurramuloo-box-office.html` | **2020** | 2019 | Ala Vaikunthapurramuloo | Jan 12, 2020 |
| `alaipayuthey-box-office.html` | **2000** | 2001 | Alaipayuthey | 2000 |
| `anniyan-box-office.html` | **2005** | 2004 | Anniyan | Jun 10, 2005 |
| `apthamitra-box-office.html` | **2004** | 1994 | Apthamitra | 2004 |
| `attarintiki-daredi-box-office.html` | **2013** | 2011 | Attarintiki Daredi | Sep 27, 2013 |
| `avengers-age-of-ultron-box-office.html` | **2015** | 2014 | Avengers: Age of Ultron | Apr 24, 2015 |
| `baashha-box-office.html` | **1995** | 1991, 1994 | Baashha | Jan 13, 1995 |
| `bagheera-box-office.html` | **2023** | 2024 | Bagheera | Dec 28, 2023 |
| `bheeshma-box-office.html` | **2020** | 2019 | Bheeshma | Feb 21, 2020 |
| `chandramukhi-box-office.html` | **2005** | 2004 | Chandramukhi | Apr 14, 2005 |
| `dasavathaaram-box-office.html` | **2008** | 2007 | Dasavathaaram | Jun 13, 2008 |
| `dhurandhar-box-office.html` | **2025** | 2026 | Dhurandhar | Dec 2025 |
| `dookudu-box-office.html` | **2011** | 2010 | Dookudu | Sep 9, 2011 |
| `drishyam-2-box-office.html` | **2021** | 2019, 2020 | Drishyam 2 | Feb 19, 2021 |
| `dune-part-two-box-office.html` | **2024** | 2023 | Dune: Part Two | Mar 1, 2024 |
| `gentleman-box-office.html` | **1993** | 1990, 1992 | Gentleman | Jan 14, 1993 |
| `ghilli-box-office.html` | **2004** | 2003 | Ghilli | Apr 1, 2004 |
| `jeans-box-office.html` | **1998** | 1997 | Jeans | 1998 |
| `julayi-box-office.html` | **2012** | 2011 | Julayi | Aug 9, 2012 |
| `kaakha-kaakha-box-office.html` | **2003** | 2002 | Kaakha Kaakha | 2003 |
| `kaalapani-box-office.html` | **1996** | 1993 | Kaalapani | 1996 |
| `kadal-box-office.html` | **2013** | 2012 | Kadal | Feb 1, 2013 |
| `kanthaswamy-box-office.html` | **2009** | 2008 | Kanthaswamy | 2009 |
| `karnan-box-office.html` | **2021** | 2020 | Karnan | Apr 9, 2021 |
| `krack-box-office.html` | **2021** | 2020 | Krack | Jan 9, 2021 |
| `kumbalangi-nights-box-office.html` | **2019** | 2017 | Kumbalangi Nights | Feb 7, 2019 |
| `lucifer-box-office.html` | **2019** | 2017, 2018 | Lucifer | Mar 28, 2019 |
| `magadheera-box-office.html` | **2009** | 2010 | Magadheera | Jul 31, 2009 |
| `maharshi-box-office.html` | **2019** | 2018 | Maharshi | May 9, 2019 |
| `manichitrathazhu-box-office.html` | **1993** | 1994 | Manichitrathazhu | 1993 |
| `marco-box-office.html` | **2024** | 2023 | Marco | Dec 20, 2024 |
| `milana-box-office.html` | **2007** | 2006 | Milana | 2007 |
| `minsara-kanavu-box-office.html` | **1997** | 1994, 1996 | Minsara Kanavu | 1997 |
| `mungaru-male-box-office.html` | **2006** | 2004 | Mungaru Male | 2006 |
| `muthu-box-office.html` | **1995** | 1996 | Muthu | 1995 |
| `narasimham-box-office.html` | **2000** | 1998 | Narasimham | 2000 |
| `padayappa-box-office.html` | **1999** | 1998 | Padayappa | Apr 10, 1999 |
| `poi-box-office.html` | **2006** | 2005 | Poi | 2006 |
| `pokiri-box-office.html` | **2006** | 1996, 2005 | Pokiri | Apr 28, 2006 |
| `premalu-box-office.html` | **2024** | 2023 | Premalu | Feb 9, 2024 |
| `race-gurram-box-office.html` | **2014** | 2013 | Race Gurram | Apr 10, 2014 |
| `rangasthalam-box-office.html` | **2018** | 2017 | Rangasthalam | Mar 30, 2018 |
| `saamy-box-office.html` | **2003** | 2002 | Saamy | 2003 |
| `simhadri-box-office.html` | **2003** | 2002 | Simhadri | Jan 14, 2003 |
| `sivaji-the-boss-box-office.html` | **2007** | 2006 | Sivaji: The Boss | Jun 15, 2007 |
| `spadikam-box-office.html` | **1995** | 1994 | Spadikam | 1995 |
| `srimanthudu-box-office.html` | **2015** | 2011, 2014 | Srimanthudu | Aug 7, 2015 |
| `temper-box-office.html` | **2015** | 2014 | Temper | Jan 9, 2015 |
| `thalapathi-box-office.html` | **1991** | 1990 | Thalapathi | Sep 6, 1991 |
| `thanmathra-box-office.html` | **2005** | 2002 | Thanmathra | 2005 |
| `the-jungle-book-box-office.html` | **2016** | 2013, 2015 | The Jungle Book | Apr 8, 2016 |
| `thenmavin-kombathu-box-office.html` | **1994** | 1990 | Thenmavin Kombathu | 1994 |
| `theri-box-office.html` | **2016** | 2015 | Theri | Apr 14, 2016 |
| `thuppakki-box-office.html` | **2012** | 2011 | Thuppakki | Dec 14, 2012 |
| `villu-box-office.html` | **2009** | 2005 | Villu | Jan 9, 2009 |
| `yennai-arindhaal-box-office.html` | **2015** | 2014 | Yennai Arindhaal | Feb 6, 2015 |
| `yevadu-box-office.html` | **2014** | 2013, 2001 | Yevadu | Jul 18, 2014 |

**68 rows to delete.** Every one is a byte-identical duplicate of a row that stays.

## B · Genuinely different films sharing a slug — need their own page

4 slugs, 8 rows.

| current page | year | title | director | language | indiaNet | suggested slug |
|---|---|---|---|---|---|---|
| `don-box-office.html` | 2006 | Don | Farhan Akhtar | Hindi | ₹52 Cr | `don-2006-box-office.html` |
| `don-box-office.html` | 2022 | Don | Cibi Chakaravarthi | Tamil | ₹40 Cr | `don-2022-box-office.html` |
| `s3-yamudu-3-box-office.html` | 2014 | S3 (Yamudu 3) | S. S. Rajamouli | Telugu | ₹55 Cr | `s3-yamudu-3-2014-box-office.html` |
| `s3-yamudu-3-box-office.html` | 2015 | S3 (Yamudu 3) | Boyapati Srinu | Telugu | ₹55 Cr | `s3-yamudu-3-2015-box-office.html` |
| `sarkar-box-office.html` | 2005 | Sarkar | Ram Gopal Varma | Hindi | ₹28 Cr | `sarkar-2005-box-office.html` |
| `sarkar-box-office.html` | 2018 | Sarkar | A. R. Murugadoss | Tamil | ₹175 Cr | `sarkar-2018-box-office.html` |
| `the-lion-king-box-office.html` | 1994 | The Lion King | Roger Allers | Hollywood | ₹8 Cr | `the-lion-king-1994-box-office.html` |
| `the-lion-king-box-office.html` | 2019 | The Lion King | Jon Favreau | Hollywood | ₹142 Cr | `the-lion-king-2019-box-office.html` |

## C · Needs a human look

8 slugs where releaseDate does not settle it.

- `bavagaru-bagunnara-box-office.html`
    - 1995 · Bavagaru Bagunnara? · E. V. V. Satyanarayana · 1996 · ₹18 Cr
    - 1998 · Bavagaru Bagunnara · E. V. V. Satyanarayana · 1996 · ₹16 Cr
- `captain-america-brave-new-world-box-office.html`
    - 2024 · Captain America: Brave New World · Julius Onah · Feb 14, 2025 · ₹42 Cr
    - 2026 · Captain America: Brave New World · Julius Onah · Feb 13, 2026 (India) · ₹38 Cr
- `chattambinadu-box-office.html`
    - 1998 · Chattambinadu · Shaji Kailas · 1996 · ₹12 Cr
    - 2000 · Chattambinadu · Shaji Kailas · 1996 · ₹12 Cr
    - 2002 · Chattambinadu · Shaji Kailas · 1996 · ₹12 Cr
    - 2005 · Chattambinadu · Shaji Kailas · 2006 · ₹18 Cr
    - 2007 · Chattambinadu · Shaji Kailas · 2006 · ₹18 Cr
    - 2009 · Chattambinadu · Shaji Kailas · 2006 · ₹18 Cr
- `christian-brothers-box-office.html`
    - 2005 · Christian Brothers · S. J. Suryah · 2011 · ₹22 Cr
    - 2007 · Christian Brothers · S. J. Suryah · 2011 · ₹22 Cr
    - 2008 · Christian Brothers · S. J. Suryah · 2011 · ₹22 Cr
- `gharana-mogudu-box-office.html`
    - 1990 · Gharana Mogudu · K. Raghavendra Rao · May 24, 1992 · ₹18 Cr
    - 1991 · Gharana Mogudu · K. Raghavendra Rao · May 1992 · ₹20 Cr
- `love-aaj-kal-box-office.html`
    - 2009 · Love Aaj Kal · Imtiaz Ali · Jul 31, 2009 · ₹55 Cr
    - 2020 · Love Aaj Kal · Imtiaz Ali · Feb 2020 · 30 Cr
- `mazha-box-office.html`
    - 1996 · Mazha · Fazil · 1999 · ₹10 Cr
    - 2000 · Mazha · Fazil · 1999 · ₹10 Cr
- `sainikudu-box-office.html`
    - 2004 · Sainikudu · M. S. Raju · May 12, 2006 · ₹55 Cr
    - 2008 · Sainikudu · M. S. Raju · May 2006 · ₹55 Cr

