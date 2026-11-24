// Seed content for the 20 investigation topics defined in Requirements.pdf.
// Investigators/Admins can edit all of this later from the Studio.

const s = (heading, body) => ({ heading, body });

export const TOPICS = [
  {
    number: 1, slug: 'mali-empire', theme: 'mali-empire',
    title: 'The Mali Empire (and the Library of Timbuktu)', region: 'West Africa', era: 'c. 1235 – 1600 CE',
    summary: 'A Sahelian empire founded by Sundiata Keita whose control of gold and salt routes made it one of the richest states of the medieval world, and whose city of Timbuktu became a center of Islamic scholarship.',
    sections: [
      s('Origins', 'Tradition credits Sundiata Keita with uniting the Mande peoples after the Battle of Kirina (c. 1235). The empire grew along the Niger River, controlling the trans-Saharan trade that linked West Africa with North Africa and the Mediterranean.'),
      s('Mansa Musa and the Hajj', 'Mansa Musa\'s pilgrimage to Mecca in 1324–1325 became legendary: his caravan distributed so much gold in Cairo that chroniclers reported its value dropped for years. The journey put Mali on European maps such as the Catalan Atlas (1375).'),
      s('The Manuscripts of Timbuktu', 'Timbuktu\'s mosques — Djinguereber, Sankore and Sidi Yahya — hosted scholars who produced and copied manuscripts on law, astronomy, medicine and poetry. Families preserved hundreds of thousands of these manuscripts for centuries, and many were smuggled to safety in 2012–2013.'),
    ],
    facts: ['The Djinguereber Mosque was built in 1327, after Mansa Musa returned from Mecca.', 'Salt was so valuable in the Sahel that it was traded almost weight-for-weight with gold in some markets.', 'The Catalan Atlas shows Mansa Musa holding a gold nugget.', 'Timbuktu\'s mud-brick mosques are re-plastered by the community every year.'],
  },
  {
    number: 2, slug: 'minoan', theme: 'minoan',
    title: 'The Minoan Civilization (Crete)', region: 'Aegean Sea', era: 'c. 3000 – 1100 BCE',
    summary: 'Europe\'s first great Bronze Age civilization, known for its palace complexes such as Knossos, vivid frescoes, maritime trade, and the still-undeciphered Linear A script.',
    sections: [
      s('Palaces without Walls', 'Minoan palaces at Knossos, Phaistos, Malia and Zakros were administrative and religious centers organized around central courts. Unlike many contemporary states, they had few defensive walls, suggesting confidence in their naval power.'),
      s('Art and Daily Life', 'Frescoes show bull-leaping, processions, dolphins and lilies. The Minoans also produced fine Kamares ware pottery and sophisticated plumbing, including terracotta pipes and flushing drains.'),
      s('Decline', 'The eruption of Thera (Santorini) around the 17th–16th century BCE damaged the Aegean world. By c. 1450 BCE Mycenaean Greeks dominated Knossos, adapting Minoan writing into Linear B.'),
    ],
    facts: ['The name "Minoan" was coined by archaeologist Arthur Evans after the mythical King Minos.', 'Linear A has still not been deciphered.', 'The Phaistos Disc is stamped, not written, making it an early example of movable type.', 'Minoan trade reached Egypt, the Levant and Anatolia.'],
  },
  {
    number: 3, slug: 'kush', theme: 'kush',
    title: 'The Kingdom of Kush (Nubia)', region: 'Nile Valley (Sudan)', era: 'c. 1070 BCE – 350 CE',
    summary: 'A Nubian kingdom that ruled Egypt as its 25th Dynasty, later flourishing at Meroë with its own script, iron industry and more pyramids than Egypt.',
    sections: [
      s('The Black Pharaohs', 'Around 747 BCE King Piye of Kush conquered Egypt, founding the 25th Dynasty. Kushite rulers such as Taharqa restored temples and revived classical Egyptian traditions before Assyrian invasions pushed them back south.'),
      s('Napata and Meroë', 'The capital moved from Napata to Meroë, where abundant iron ore and wood made Kush a major iron producer. Meroë\'s royal cemeteries contain around 200 steep-sided pyramids.'),
      s('Queens and Script', 'Ruling queens known as Kandakes held great power; one is mentioned in the Bible. The Meroitic script can be read phonetically, but the language is still only partly understood.'),
    ],
    facts: ['Sudan has more pyramids than Egypt.', 'Kandake Amanirenas fought Roman armies in the 20s BCE.', 'Meroitic script had both hieroglyphic and cursive forms.', 'Taharqa is mentioned in the Hebrew Bible as Tirhakah.'],
  },
  {
    number: 4, slug: 'khmer', theme: 'khmer',
    title: 'The Khmer Empire (Angkor, Cambodia)', region: 'Southeast Asia', era: '802 – 1431 CE',
    summary: 'A powerful Southeast Asian empire whose capital, Angkor, was one of the largest pre-industrial cities on Earth, sustained by a vast hydraulic network and crowned by Angkor Wat.',
    sections: [
      s('A God-King', 'In 802 CE Jayavarman II proclaimed himself universal monarch (chakravartin), founding the empire. Kings built state temples on artificial mountains representing Mount Meru, home of the gods.'),
      s('Angkor Wat and Angkor Thom', 'Suryavarman II built Angkor Wat in the early 12th century as a temple to Vishnu. Jayavarman VII later built Angkor Thom and the Bayon, with its serene stone faces, and converted the state to Mahayana Buddhism.'),
      s('Water and Collapse', 'Huge reservoirs (barays) and canals managed monsoon water. LiDAR surveys revealed a sprawling urban landscape; prolonged droughts and floods, plus war with Ayutthaya, contributed to Angkor\'s decline.'),
    ],
    facts: ['Angkor Wat is the largest religious monument in the world.', 'Angkor Wat appears on Cambodia\'s national flag.', 'The West Baray reservoir is about 8 km long.', 'LiDAR scans in 2012 and 2015 revealed hidden city grids under the jungle.'],
  },
  {
    number: 5, slug: 'saba', theme: 'saba',
    title: 'The Kingdom of Saba (Ancient Yemen)', region: 'Southern Arabia', era: 'c. 1000 BCE – 275 CE',
    summary: 'The wealthy South Arabian kingdom of the incense trade, associated with the Queen of Sheba and famed for the Great Dam of Marib.',
    sections: [
      s('Incense Kingdom', 'Saba grew rich trading frankincense and myrrh along caravan routes to the Mediterranean. Its capital Marib sat at the edge of the desert where caravans began their northward journey.'),
      s('The Marib Dam', 'The Great Dam of Marib diverted seasonal floods to irrigate thousands of hectares. Its final collapse, around the 6th century CE, became a symbol of the end of an era in Arabian tradition.'),
      s('Sheba in Legend', 'The Queen of Sheba appears in the Bible, the Qur\'an and the Ethiopian Kebra Nagast. Archaeology has not confirmed her identity, but Sabaean temples such as the Mahram Bilqis bear her name in local tradition.'),
    ],
    facts: ['Sabaeans wrote in the South Arabian alphabet, called Musnad.', 'Frankincense comes from the resin of Boswellia trees.', 'The Awwam Temple at Marib is also called Mahram Bilqis.', 'Saba was eventually absorbed by the Himyarite Kingdom.'],
  },
  {
    number: 6, slug: 'etruscan', theme: 'etruscan',
    title: 'The Etruscan Civilization', region: 'Central Italy', era: 'c. 900 – 27 BCE',
    summary: 'A sophisticated pre-Roman people of Etruria whose art, religion, engineering and metalwork deeply shaped early Rome.',
    sections: [
      s('A League of Cities', 'Etruria was organized as independent city-states such as Tarquinia, Cerveteri, Veii and Volterra, loosely joined in a twelve-city league. Several early kings of Rome were Etruscan.'),
      s('Tombs and Banquets', 'Painted tombs at Tarquinia show banquets, dancing and games. Couples reclining together on sarcophagi suggest women had higher social standing than in Greece.'),
      s('Language and Legacy', 'Etruscan is a non-Indo-European language written in an alphabet borrowed from Greek. Rome inherited Etruscan symbols such as the fasces, gladiatorial games and divination by haruspices.'),
    ],
    facts: ['The Sarcophagus of the Spouses is made of painted terracotta.', 'Etruscan bronze-working was admired across the Mediterranean.', 'The Liber Linteus, the longest Etruscan text, survived as Egyptian mummy wrappings.', 'The Romans absorbed Etruria fully by the 1st century BCE.'],
  },
  {
    number: 7, slug: 'hittite', theme: 'hittite',
    title: 'The Hittite Empire', region: 'Anatolia', era: 'c. 1650 – 1180 BCE',
    summary: 'A Bronze Age Anatolian power ruled from Hattusa that rivaled Egypt, signed history\'s earliest known peace treaty, and left the oldest written Indo-European language.',
    sections: [
      s('Hattusa', 'The capital Hattusa, near modern Boğazkale in Turkey, was protected by massive walls and gates such as the Lion Gate. Tens of thousands of clay tablets were found in its archives.'),
      s('Kadesh and Peace', 'After the Battle of Kadesh (c. 1274 BCE) against Ramesses II, the Hittites and Egyptians signed a peace treaty around 1259 BCE. Versions survive in both Egyptian hieroglyphs and Akkadian cuneiform.'),
      s('Law and Collapse', 'Hittite law codes favored compensation over harsh punishment. The empire collapsed around 1180 BCE during the wider Late Bronze Age collapse.'),
    ],
    facts: ['A replica of the Kadesh treaty hangs at the United Nations headquarters.', 'Hittite was deciphered by Bedřich Hrozný in 1915.', 'The Hittites worshipped "a thousand gods".', 'Hattusa is a UNESCO World Heritage Site.'],
  },
  {
    number: 8, slug: 'kiribati', theme: 'kiribati',
    title: 'Kiribati (Pacific Microstate)', region: 'Central Pacific', era: 'Independent since 1979',
    summary: 'A nation of 33 low-lying atolls and islands spread across a vast area of ocean, straddling the equator and the International Date Line.',
    sections: [
      s('Atolls and Ocean', 'Kiribati\'s territory spans about 3.5 million km² of ocean but only around 800 km² of land, in three groups: the Gilbert, Phoenix and Line Islands. The capital is on South Tarawa.'),
      s('First to Greet the Day', 'In 1995 Kiribati moved the International Date Line so the whole country shares the same date. Its Line Islands are among the first places on Earth to start each new day.'),
      s('Climate Frontline', 'Most of the land lies only a few meters above sea level, making rising seas an existential concern. The Phoenix Islands Protected Area is one of the largest marine protected areas in the world.'),
    ],
    facts: ['Kiritimati (Christmas Island) is the largest coral atoll by land area.', '"Kiribati" is the local rendering of "Gilberts" and is pronounced "Kiri-bas".', 'Kiribati is the only country in all four hemispheres.', 'Traditional maneaba meeting houses are central to village life.'],
  },
  {
    number: 9, slug: 'lesotho', theme: 'lesotho',
    title: 'Lesotho (The Kingdom in the Sky)', region: 'Southern Africa', era: 'Founded 1820s; independent 1966',
    summary: 'A mountain kingdom entirely surrounded by South Africa, with the highest low point of any country on Earth.',
    sections: [
      s('Moshoeshoe I', 'King Moshoeshoe I united the Basotho in the 1820s from the flat-topped mountain fortress of Thaba Bosiu, using diplomacy to survive pressure from rival groups and colonial powers.'),
      s('A Highland Nation', 'Every part of Lesotho lies above about 1,400 meters. Thabana Ntlenyana reaches 3,482 m, the highest point in southern Africa.'),
      s('Culture and Water', 'The Basotho blanket and the conical mokorotlo hat are national symbols. The Lesotho Highlands Water Project sends water to South Africa\'s Gauteng region and generates hydroelectric power.'),
    ],
    facts: ['Lesotho is one of only three countries completely surrounded by another country.', 'Afriski is one of the few ski resorts in Africa.', 'The mokorotlo hat appears on the national flag.', 'Sani Pass is one of the steepest mountain roads in Africa.'],
  },
  {
    number: 10, slug: 'transnistria', theme: 'transnistria',
    title: 'Transnistria (Unrecognized State)', region: 'Eastern Europe', era: 'Declared 1990',
    summary: 'A breakaway strip of land between the Dniester River and Ukraine that functions with its own government and currency but is internationally recognized as part of Moldova.',
    sections: [
      s('Origins of the Conflict', 'As the Soviet Union dissolved, tensions between the Moldovan government and the largely Russian- and Ukrainian-speaking population east of the Dniester led to a short war in 1992, followed by a ceasefire.'),
      s('A De Facto State', 'The region, centered on Tiraspol, has its own institutions, police, and the Transnistrian ruble, including plastic coins. No UN member state recognizes it.'),
      s('A Frozen Conflict', 'Political scientists study Transnistria as a "frozen conflict". Negotiations have involved Moldova, the OSCE, Russia, Ukraine and the EU, with no final settlement.'),
    ],
    facts: ['Transnistria issued some of the world\'s first plastic coins in 2014.', 'Its capital is Tiraspol.', 'It is a narrow strip about 400 km long.', 'Visitors receive a migration card rather than a passport stamp.'],
  },
  {
    number: 11, slug: 'socotra', theme: 'socotra',
    title: 'Socotra Island (Yemen)', region: 'Arabian Sea', era: 'Inhabited for millennia',
    summary: 'An isolated archipelago so biologically unique that about a third of its plant species exist nowhere else, including the umbrella-shaped dragon\'s blood tree.',
    sections: [
      s('Island of Endemism', 'Long geological isolation produced remarkable endemic species. The dragon\'s blood tree (Dracaena cinnabari) and the swollen desert rose (Adenium obesum socotranum) are iconic.'),
      s('Ancient Trade', 'Socotra sat on maritime routes between India, Arabia and East Africa. Inscriptions in Hoq Cave left by sailors in several ancient scripts reveal its long role in trade.'),
      s('People and Language', 'Islanders speak Soqotri, a Modern South Arabian language with a rich oral poetry tradition. The archipelago was inscribed as a UNESCO World Heritage Site in 2008.'),
    ],
    facts: ['Dragon\'s blood resin was used as dye, varnish and medicine.', 'Around 37% of Socotra\'s plant species are endemic.', 'Soqotri is traditionally an unwritten language.', 'The island\'s name may come from Sanskrit for "island of bliss".'],
  },
  {
    number: 12, slug: 'mustang', theme: 'mustang',
    title: 'The Kingdom of Mustang (Nepal)', region: 'Himalaya', era: 'c. 1380 – 2008 CE',
    summary: 'A former Tibetan Buddhist kingdom in Nepal\'s high desert, with the walled capital Lo Manthang and ancient cliff caves.',
    sections: [
      s('The Kingdom of Lo', 'Founded by Ame Pal in the late 14th century, Lo grew wealthy on salt and wool trade between Tibet and the Indian subcontinent. Its kings kept a ceremonial role until Nepal abolished the monarchy in 2008.'),
      s('Lo Manthang', 'The walled capital contains 15th-century monasteries such as Jampa and Thubchen, whose murals have been carefully restored.'),
      s('The Sky Caves', 'Thousands of man-made caves dug into cliff faces were used as tombs, meditation chambers and shelters. Archaeologists have found manuscripts, murals and human remains within them.'),
    ],
    facts: ['Upper Mustang was closed to foreign visitors until 1992.', 'The region lies in the rain shadow of the Annapurna range.', 'Tiji, a three-day festival, celebrates the victory of good over evil.', 'Lo Manthang\'s walls are made of mud-brick.'],
  },
  {
    number: 13, slug: 'lapita', theme: 'lapita',
    title: 'The Lapita Culture (Ancient Oceania)', region: 'Western Pacific', era: 'c. 1600 – 500 BCE',
    summary: 'The seafaring ancestors of many Polynesians, identified by distinctive dentate-stamped pottery found from New Guinea to Samoa.',
    sections: [
      s('Pottery as a Trail', 'Lapita pottery, decorated by pressing toothed tools into wet clay, marks the spread of a culture across thousands of kilometers of ocean. It is named after a site in New Caledonia.'),
      s('Master Navigators', 'Lapita voyagers sailed outrigger canoes into the remote Pacific, reaching Vanuatu, Fiji, Tonga and Samoa — islands never before inhabited by humans.'),
      s('Ancestral Polynesians', 'DNA studies of remains from the Teouma cemetery in Vanuatu link Lapita people to East Asian populations and to later Polynesian societies.'),
    ],
    facts: ['Some Lapita pots depict human faces.', 'Lapita voyagers carried pigs, dogs, chickens and crops.', 'Obsidian traded across Lapita sites came from New Britain.', 'Teouma in Vanuatu is the oldest cemetery in the remote Pacific.'],
  },
  {
    number: 14, slug: 'nabataean', theme: 'nabataean',
    title: 'The Nabataean Kingdom (Petra)', region: 'Arabia / Levant', era: 'c. 4th century BCE – 106 CE',
    summary: 'Arab caravan traders who carved the rose-red city of Petra from sandstone cliffs and mastered water engineering in the desert.',
    sections: [
      s('Masters of Caravans', 'The Nabataeans controlled routes carrying incense, spices and textiles between Arabia and the Mediterranean, growing wealthy through trade and tolls.'),
      s('Petra', 'Petra\'s facades — including Al-Khazneh (the Treasury) and Ad-Deir (the Monastery) — are carved directly into cliffs. The city is approached through the Siq, a narrow canyon over a kilometer long.'),
      s('Water in the Desert', 'Channels, cisterns and dams captured rare rainfall and flash floods, allowing Petra to support a large population. In 106 CE Rome annexed the kingdom as the province of Arabia Petraea.'),
    ],
    facts: ['The Nabataean script developed into the Arabic alphabet.', 'Petra was rediscovered for Europe by Johann Ludwig Burckhardt in 1812.', 'Petra is one of the New Seven Wonders of the World.', 'Hegra (Mada\'in Salih) in Saudi Arabia is the second Nabataean city.'],
  },
  {
    number: 15, slug: 'khiva', theme: 'khiva',
    title: 'The Khanate of Khiva (Central Asia)', region: 'Khwarazm (Uzbekistan)', era: '1511 – 1920 CE',
    summary: 'A Silk Road khanate whose walled inner city, Itchan Kala, preserves turquoise-tiled minarets, madrasas and palaces.',
    sections: [
      s('Khwarazm', 'Khiva lies in the ancient oasis of Khwarazm on the lower Amu Darya. From 1511 it was ruled by Uzbek khans and became the capital of a khanate in the 17th century.'),
      s('Itchan Kala', 'The inner town is enclosed by mud-brick walls and contains more than 50 historic monuments. The unfinished Kalta Minor minaret is covered in glazed turquoise tiles.'),
      s('Under the Empire', 'Khiva became a Russian protectorate in 1873. In 1920 the last khan was deposed and the Khorezm People\'s Soviet Republic was declared.'),
    ],
    facts: ['Itchan Kala was the first site in Central Asia on the UNESCO list (1990).', 'Al-Khwarizmi, whose name gave us "algorithm", came from Khwarazm.', 'The Islam Khodja minaret is the tallest in Khiva.', 'The Juma Mosque has over 200 carved wooden columns.'],
  },
  {
    number: 16, slug: 'sao-tome', theme: 'sao-tome',
    title: 'São Tomé and Príncipe', region: 'Gulf of Guinea', era: 'Independent since 1975',
    summary: 'Africa\'s second-smallest country, two volcanic islands that went from colonial sugar and cocoa plantations to a biodiversity hotspot.',
    sections: [
      s('Uninhabited Islands', 'The islands were uninhabited when Portuguese navigators arrived around 1470. Portugal settled them with colonists and enslaved Africans to grow sugar.'),
      s('The Cocoa Islands', 'In the early 20th century São Tomé was one of the world\'s largest cocoa producers. Large plantations (roças) relied on coerced contract labor, a history now reflected in their preserved buildings.'),
      s('Nature and Culture', 'Dense rainforest, the volcanic spire Pico Cão Grande and many endemic birds make the islands ecologically important. Creole languages such as Forro reflect the islands\' mixed heritage.'),
    ],
    facts: ['Pico Cão Grande is a volcanic plug that rises about 300 m above the forest.', 'The equator passes through Ilhéu das Rolas.', 'Príncipe is a UNESCO Biosphere Reserve.', 'Tchiloli is a traditional theater form performed on the islands.'],
  },
  {
    number: 17, slug: 'dilmun', theme: 'dilmun',
    title: 'The Dilmun Civilization (Ancient Bahrain)', region: 'Persian Gulf', era: 'c. 3000 – 600 BCE',
    summary: 'A Bronze Age trading civilization centered on Bahrain that linked Mesopotamia with the Indus Valley and appears in Sumerian myth as a paradise.',
    sections: [
      s('Land of Paradise', 'Sumerian texts describe Dilmun as a pure land where sickness and death did not exist. In the Epic of Gilgamesh, it is associated with the immortal flood survivor.'),
      s('Gulf Trade Hub', 'Dilmun merchants handled copper from Magan (Oman) and goods from Meluhha (the Indus Valley), using distinctive round stamp seals to mark trade goods.'),
      s('Burial Mounds and Qal\'at al-Bahrain', 'Bahrain\'s landscape preserves thousands of Dilmun burial mounds. The excavated settlement of Qal\'at al-Bahrain was an ancient harbor and capital.'),
    ],
    facts: ['Bahrain once had an estimated 75,000+ burial mounds.', 'Freshwater springs beneath the sea made Bahrain an oasis.', 'Dilmun Burial Mounds became a UNESCO site in 2019.', 'Pearl diving is one of Bahrain\'s oldest traditions.'],
  },
  {
    number: 18, slug: 'lydia', theme: 'lydia',
    title: 'The Kingdom of Lydia (Ancient Anatolia)', region: 'Western Anatolia', era: 'c. 1200 – 546 BCE',
    summary: 'The Anatolian kingdom credited with minting some of the world\'s first coins, ruled from Sardis by the proverbially rich King Croesus.',
    sections: [
      s('Electrum Coins', 'In the 7th century BCE Lydia struck coins from electrum, a natural gold-silver alloy from the Pactolus River. Under Croesus, separate pure gold and silver coins appeared.'),
      s('Sardis', 'The capital Sardis controlled routes between the Aegean and the Anatolian interior. Its markets made Lydia an early center of retail trade.'),
      s('Fall to Persia', 'According to Herodotus, Croesus consulted the Oracle of Delphi, which said a great empire would fall if he attacked Persia. The empire that fell was his own, conquered by Cyrus the Great in 546 BCE.'),
    ],
    facts: ['"As rich as Croesus" is still an English expression.', 'Lydian coins were stamped with a lion\'s head.', 'Herodotus says the Lydians invented games like dice.', 'The Royal Road of Persia later started at Sardis.'],
  },
  {
    number: 19, slug: 'palau', theme: 'palau',
    title: 'Palau (Micronesia)', region: 'Western Pacific', era: 'Independent since 1994',
    summary: 'An island nation of more than 300 islands famed for its Rock Islands, giant stone money, and pioneering ocean conservation.',
    sections: [
      s('The Rock Islands', 'Hundreds of mushroom-shaped limestone islands rise from turquoise lagoons. Jellyfish Lake hosts millions of golden jellyfish that evolved with weak stings.'),
      s('Stone Money and Tradition', 'Palauans traditionally quarried large limestone discs that were carried to Yap as stone money. Traditional bai meeting houses are decorated with painted storyboards.'),
      s('Ocean Pledge', 'Palau created one of the world\'s first shark sanctuaries in 2009. Visitors sign the Palau Pledge, stamped in their passports, promising to protect the environment.'),
    ],
    facts: ['The Palau National Marine Sanctuary protects about 80% of its waters.', 'Palau uses the US dollar.', 'Babeldaob is the second-largest island in Micronesia.', 'The Rock Islands Southern Lagoon is a UNESCO site.'],
  },
  {
    number: 20, slug: 'kanem-bornu', theme: 'kanem-bornu',
    title: 'The Kanem–Bornu Empire (Central Africa)', region: 'Lake Chad Basin', era: 'c. 700 – 1900 CE',
    summary: 'One of Africa\'s longest-lasting states, centered on Lake Chad, ruled by the Sayfawa dynasty for roughly a thousand years.',
    sections: [
      s('Kanem', 'The kingdom of Kanem arose northeast of Lake Chad, controlling trans-Saharan routes toward Libya. Its rulers adopted Islam by the 11th century.'),
      s('Bornu', 'In the 14th century the court moved west of Lake Chad to Bornu. Under Idris Alooma (late 16th century) the empire used imported firearms and Turkish musketeers.'),
      s('A Thousand Years', 'The Sayfawa dynasty ruled until the 19th century, when power passed to the al-Kanemi family. Its long survival makes it a key case study in African statecraft.'),
    ],
    facts: ['The Sayfawa dynasty is among the longest-ruling in history.', 'Idris Alooma made the pilgrimage to Mecca.', 'Bornu\'s capital Ngazargamu was founded in the 15th century.', 'Kanem traded horses, salt and textiles across the Sahara.'],
  },
];
