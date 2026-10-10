-- temporary seed data
-- Run AFTER schema.sql. Demo users, a demo trip and community posts
-- are created by `npm run seed:demo` (needs Supabase Auth admin API).

insert into public.places (name, description, address, lat, lng, vibes, price_level, source) values
-- 🍜 Eating
('Kam Long Ah Zai Curry Fish Head', 'Long-running curry fish head spot in the city centre. Expect a queue at lunch; go early.', 'Jalan Wong Ah Fook, Johor Bahru', 1.4630, 103.7620, '{eating}', 2, 'curated'),
('Hiap Joo Bakery & Biscuit Factory', 'Old-school wood-fired oven bakery famous for banana cake. Sells out by early afternoon.', 'Jalan Tan Hiok Nee, Johor Bahru', 1.4628, 103.7614, '{eating,culture}', 1, 'curated'),
('Restoran Hua Mui', 'Hainanese kopitiam serving chicken chop and kaya toast in a retro setting.', 'Jalan Trus, Johor Bahru', 1.4598, 103.7636, '{eating,culture}', 1, 'curated'),
('Jalan Dhoby Cafe Street', 'Pre-war shophouses converted into cafes, bakeries and small studios. Good for a slow afternoon.', 'Jalan Dhoby, Johor Bahru', 1.4618, 103.7622, '{eating,culture}', 2, 'curated'),
('Mount Austin Cafe Strip', 'Dense cluster of brunch cafes, dessert bars and Korean BBQ in a residential township.', 'Jalan Austin Heights, Johor Bahru', 1.5600, 103.7810, '{eating}', 2, 'curated'),
('Taman Pelangi Night Hawkers', 'Evening hawker stalls popular with locals; cheap satay, char kway teow and drinks.', 'Taman Pelangi, Johor Bahru', 1.4793, 103.7744, '{eating}', 1, 'community'),
('Bazaar Karat Night Market', 'Weekend-evening street market near the checkpoint with snacks, clothes and trinkets.', 'Jalan Wong Ah Fook, Johor Bahru', 1.4610, 103.7627, '{eating,activities}', 1, 'curated'),
('Kong Kong Seafood Village', 'Riverside kelong-style seafood restaurants. Worth the drive for chilli crab at local prices.', 'Kampung Sungai Kong Kong, Masai', 1.5133, 103.9918, '{eating,adventure}', 2, 'community'),

-- 🎭 Culture
('Johor Old Chinese Temple', 'One of the oldest Chinese temples in JB, uniting five dialect groups. Small but beautifully kept.', 'Jalan Trus, Johor Bahru', 1.4596, 103.7623, '{culture}', 1, 'curated'),
('Arulmigu Sri Rajakaliamman Glass Temple', 'Hindu temple with interiors covered in glass mosaic. Modest dress required; small entrance fee for visitors.', 'Jalan Tun Abdul Razak, Johor Bahru', 1.4724, 103.7591, '{culture}', 1, 'curated'),
('Sultan Abu Bakar State Mosque', 'Victorian-influenced mosque overlooking the Straits of Johor. Visit outside prayer times.', 'Jalan Skudai, Johor Bahru', 1.4580, 103.7484, '{culture}', 1, 'curated'),
('Tan Hiok Nee Heritage Street', 'Walkable heritage street with shophouses, murals and cafes in the old town.', 'Jalan Tan Hiok Nee, Johor Bahru', 1.4627, 103.7616, '{culture,eating}', 1, 'curated'),
('Johor Bahru Chinese Heritage Museum', 'Compact museum on the history of the Chinese community in Johor.', 'Jalan Ibrahim, Johor Bahru', 1.4610, 103.7615, '{culture}', 1, 'curated'),
('Dataran Bandaraya Johor Bahru', 'City square with the clock tower; nice for evening photos and a short walk.', 'Jalan Abdul Ibrahim, Johor Bahru', 1.4648, 103.7590, '{culture,activities}', 1, 'community'),

-- 🎯 Activities
('Legoland Malaysia Resort', 'Theme park plus water park in Iskandar Puteri. Best via Tuas Second Link.', 'Medini, Iskandar Puteri', 1.4268, 103.6299, '{activities}', 4, 'curated'),
('Mid Valley Southkey', 'Large mall with cinema, supermarket and plenty of food options.', 'Persiaran Southkey, Johor Bahru', 1.5005, 103.7790, '{activities,eating}', 2, 'curated'),
('Paradigm Mall Johor Bahru', 'Mall with ice rink and family attractions near Skudai.', 'Jalan Skudai, Johor Bahru', 1.5115, 103.6855, '{activities}', 2, 'curated'),
('KSL City Mall', 'Popular one-stop mall for groceries, massage and food, close to the CIQ.', 'Jalan Seladang, Taman Abad, Johor Bahru', 1.4844, 103.7638, '{activities,eating}', 2, 'curated'),
('Johor Premium Outlets', 'Outlet mall in Kulai with international brands. Go on a weekday to avoid crowds.', 'Indahpura, Kulai', 1.5890, 103.6150, '{activities}', 3, 'curated'),
('Desaru Coast Adventure Waterpark', 'Large waterpark on the east coast; a full-day trip from SG.', 'Desaru Coast, Bandar Penawar', 1.5470, 104.2570, '{activities,adventure}', 3, 'curated'),

-- 🏔️ Adventure
('Gunung Pulai Recreational Forest', 'Forest trails and a waterfall about 40 minutes from the city. Wear proper shoes.', 'Kulai, Johor', 1.6000, 103.5400, '{adventure}', 1, 'community'),
('Tanjung Piai National Park', 'Mangrove boardwalks at the southernmost tip of mainland Asia.', 'Pontian, Johor', 1.2678, 103.5103, '{adventure,culture}', 1, 'curated'),
('Kukup Fishing Village', 'Stilt village over the water with seafood restaurants and boat rides to the island.', 'Kukup, Pontian', 1.3240, 103.4440, '{adventure,eating}', 2, 'community'),
('Taman Hutan Bandar MBJB', 'City forest park with jogging loops and a lake. Quiet early in the morning.', 'Jalan Tasek Utara, Johor Bahru', 1.4920, 103.7360, '{adventure,activities}', 1, 'community');
