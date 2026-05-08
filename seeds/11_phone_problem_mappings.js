exports.seed = async function (knex) {
  await knex('phone_problem_mappings').del();

  const mappings = [
    // iPhone 15 Pro Max mappings
    {
      id: '40000000-0000-4000-8000-000000000001',
      phone_category_id: '10000000-0000-4000-8000-000000000002', // iPhone 15 Pro Max
      problem_category_id: '20000000-0000-4000-8000-000000000011', // Ekran singan
    },
    {
      id: '40000000-0000-4000-8000-000000000002',
      phone_category_id: '10000000-0000-4000-8000-000000000002', // iPhone 15 Pro Max
      problem_category_id: '20000000-0000-4000-8000-000000000012', // Ekran qora
    },
    {
      id: '40000000-0000-4000-8000-000000000003',
      phone_category_id: '10000000-0000-4000-8000-000000000002', // iPhone 15 Pro Max
      problem_category_id: '20000000-0000-4000-8000-000000000013', // Sensorli ekran ishlamaydi
    },
    {
      id: '40000000-0000-4000-8000-000000000004',
      phone_category_id: '10000000-0000-4000-8000-000000000002', // iPhone 15 Pro Max
      problem_category_id: '20000000-0000-4000-8000-000000000022', // Batareya almashtirish
    },

    // iPhone 15 Pro mappings
    {
      id: '40000000-0000-4000-8000-000000000005',
      phone_category_id: '10000000-0000-4000-8000-000000000003', // iPhone 15 Pro
      problem_category_id: '20000000-0000-4000-8000-000000000011', // Ekran singan
    },
    {
      id: '40000000-0000-4000-8000-000000000006',
      phone_category_id: '10000000-0000-4000-8000-000000000003', // iPhone 15 Pro
      problem_category_id: '20000000-0000-4000-8000-000000000012', // Ekran qora
    },
    {
      id: '40000000-0000-4000-8000-000000000007',
      phone_category_id: '10000000-0000-4000-8000-000000000003', // iPhone 15 Pro
      problem_category_id: '20000000-0000-4000-8000-000000000021', // Batareya tez tugaydi
    },
    {
      id: '40000000-0000-4000-8000-000000000008',
      phone_category_id: '10000000-0000-4000-8000-000000000003', // iPhone 15 Pro
      problem_category_id: '20000000-0000-4000-8000-000000000041', // Kamera ochilmaydi
    },

    // iPhone 15 mappings
    {
      id: '40000000-0000-4000-8000-000000000009',
      phone_category_id: '10000000-0000-4000-8000-000000000004', // iPhone 15
      problem_category_id: '20000000-0000-4000-8000-000000000011', // Ekran singan
    },
    {
      id: '40000000-0000-4000-8000-000000000010',
      phone_category_id: '10000000-0000-4000-8000-000000000004', // iPhone 15
      problem_category_id: '20000000-0000-4000-8000-000000000051', // Zaryadlanmaydi
    },
    {
      id: '40000000-0000-4000-8000-000000000011',
      phone_category_id: '10000000-0000-4000-8000-000000000004', // iPhone 15
      problem_category_id: '20000000-0000-4000-8000-000000000061', // WiFi ishlamaydi
    },

    // iPhone 14 Pro Max mappings
    {
      id: '40000000-0000-4000-8000-000000000012',
      phone_category_id: '10000000-0000-4000-8000-000000000006', // iPhone 14 Pro Max
      problem_category_id: '20000000-0000-4000-8000-000000000011', // Ekran singan
    },
    {
      id: '40000000-0000-4000-8000-000000000013',
      phone_category_id: '10000000-0000-4000-8000-000000000006', // iPhone 14 Pro Max
      problem_category_id: '20000000-0000-4000-8000-000000000022', // Batareya almashtirish
    },
    {
      id: '40000000-0000-4000-8000-000000000014',
      phone_category_id: '10000000-0000-4000-8000-000000000006', // iPhone 14 Pro Max
      problem_category_id: '20000000-0000-4000-8000-000000000031', // Ovoz chiqmaydi
    },

    // iPhone 14 mappings
    {
      id: '40000000-0000-4000-8000-000000000015',
      phone_category_id: '10000000-0000-4000-8000-000000000008', // iPhone 14
      problem_category_id: '20000000-0000-4000-8000-000000000011', // Ekran singan
    },
    {
      id: '40000000-0000-4000-8000-000000000016',
      phone_category_id: '10000000-0000-4000-8000-000000000008', // iPhone 14
      problem_category_id: '20000000-0000-4000-8000-000000000021', // Batareya tez tugaydi
    },
    {
      id: '40000000-0000-4000-8000-000000000017',
      phone_category_id: '10000000-0000-4000-8000-000000000008', // iPhone 14
      problem_category_id: '20000000-0000-4000-8000-000000000071', // Telefon sekin ishlaydi
    },

    // iPhone 13 mappings
    {
      id: '40000000-0000-4000-8000-000000000018',
      phone_category_id: '10000000-0000-4000-8000-000000000010', // iPhone 13
      problem_category_id: '20000000-0000-4000-8000-000000000011', // Ekran singan
    },
    {
      id: '40000000-0000-4000-8000-000000000019',
      phone_category_id: '10000000-0000-4000-8000-000000000010', // iPhone 13
      problem_category_id: '20000000-0000-4000-8000-000000000022', // Batareya almashtirish
    },
    {
      id: '40000000-0000-4000-8000-000000000020',
      phone_category_id: '10000000-0000-4000-8000-000000000010', // iPhone 13
      problem_category_id: '20000000-0000-4000-8000-000000000052', // Zaryadlash porti buzilgan
    },

    // Samsung Galaxy S24 Ultra mappings
    {
      id: '40000000-0000-4000-8000-000000000021',
      phone_category_id: '10000000-0000-4000-8000-000000000021', // Galaxy S24 Ultra
      problem_category_id: '20000000-0000-4000-8000-000000000011', // Ekran singan
    },
    {
      id: '40000000-0000-4000-8000-000000000022',
      phone_category_id: '10000000-0000-4000-8000-000000000021', // Galaxy S24 Ultra
      problem_category_id: '20000000-0000-4000-8000-000000000022', // Batareya almashtirish
    },
    {
      id: '40000000-0000-4000-8000-000000000023',
      phone_category_id: '10000000-0000-4000-8000-000000000021', // Galaxy S24 Ultra
      problem_category_id: '20000000-0000-4000-8000-000000000041', // Kamera ochilmaydi
    },

    // Samsung Galaxy S24 mappings
    {
      id: '40000000-0000-4000-8000-000000000024',
      phone_category_id: '10000000-0000-4000-8000-000000000023', // Galaxy S24
      problem_category_id: '20000000-0000-4000-8000-000000000011', // Ekran singan
    },
    {
      id: '40000000-0000-4000-8000-000000000025',
      phone_category_id: '10000000-0000-4000-8000-000000000023', // Galaxy S24
      problem_category_id: '20000000-0000-4000-8000-000000000021', // Batareya tez tugaydi
    },
    {
      id: '40000000-0000-4000-8000-000000000026',
      phone_category_id: '10000000-0000-4000-8000-000000000023', // Galaxy S24
      problem_category_id: '20000000-0000-4000-8000-000000000062', // Bluetooth ishlamaydi
    },

    // Samsung Galaxy A54 mappings
    {
      id: '40000000-0000-4000-8000-000000000027',
      phone_category_id: '10000000-0000-4000-8000-000000000025', // Galaxy A54
      problem_category_id: '20000000-0000-4000-8000-000000000011', // Ekran singan
    },
    {
      id: '40000000-0000-4000-8000-000000000028',
      phone_category_id: '10000000-0000-4000-8000-000000000025', // Galaxy A54
      problem_category_id: '20000000-0000-4000-8000-000000000051', // Zaryadlanmaydi
    },
    {
      id: '40000000-0000-4000-8000-000000000029',
      phone_category_id: '10000000-0000-4000-8000-000000000025', // Galaxy A54
      problem_category_id: '20000000-0000-4000-8000-000000000072', // Ilovalar ishlamaydi
    },

    // Xiaomi Mi 14 Ultra mappings
    {
      id: '40000000-0000-4000-8000-000000000030',
      phone_category_id: '10000000-0000-4000-8000-000000000031', // Mi 14 Ultra
      problem_category_id: '20000000-0000-4000-8000-000000000011', // Ekran singan
    },
    {
      id: '40000000-0000-4000-8000-000000000031',
      phone_category_id: '10000000-0000-4000-8000-000000000031', // Mi 14 Ultra
      problem_category_id: '20000000-0000-4000-8000-000000000041', // Kamera ochilmaydi
    },
    {
      id: '40000000-0000-4000-8000-000000000032',
      phone_category_id: '10000000-0000-4000-8000-000000000031', // Mi 14 Ultra
      problem_category_id: '20000000-0000-4000-8000-000000000063', // Mobil internet ishlamaydi
    },

    // Redmi Note 13 Pro mappings
    {
      id: '40000000-0000-4000-8000-000000000033',
      phone_category_id: '10000000-0000-4000-8000-000000000032', // Redmi Note 13 Pro
      problem_category_id: '20000000-0000-4000-8000-000000000011', // Ekran singan
    },
    {
      id: '40000000-0000-4000-8000-000000000034',
      phone_category_id: '10000000-0000-4000-8000-000000000032', // Redmi Note 13 Pro
      problem_category_id: '20000000-0000-4000-8000-000000000021', // Batareya tez tugaydi
    },
    {
      id: '40000000-0000-4000-8000-000000000035',
      phone_category_id: '10000000-0000-4000-8000-000000000032', // Redmi Note 13 Pro
      problem_category_id: '20000000-0000-4000-8000-000000000073', // Virus tozalash
    },

    // POCO X6 Pro mappings
    {
      id: '40000000-0000-4000-8000-000000000036',
      phone_category_id: '10000000-0000-4000-8000-000000000033', // POCO X6 Pro
      problem_category_id: '20000000-0000-4000-8000-000000000011', // Ekran singan
    },
    {
      id: '40000000-0000-4000-8000-000000000037',
      phone_category_id: '10000000-0000-4000-8000-000000000033', // POCO X6 Pro
      problem_category_id: '20000000-0000-4000-8000-000000000052', // Zaryadlash porti buzilgan
    },
    {
      id: '40000000-0000-4000-8000-000000000038',
      phone_category_id: '10000000-0000-4000-8000-000000000033', // POCO X6 Pro
      problem_category_id: '20000000-0000-4000-8000-000000000074', // Tizimni qayta tiklash
    },

    // Oppo Find X7 Ultra mappings
    {
      id: '40000000-0000-4000-8000-000000000039',
      phone_category_id: '10000000-0000-4000-8000-000000000041', // Find X7 Ultra
      problem_category_id: '20000000-0000-4000-8000-000000000011', // Ekran singan
    },
    {
      id: '40000000-0000-4000-8000-000000000040',
      phone_category_id: '10000000-0000-4000-8000-000000000041', // Find X7 Ultra
      problem_category_id: '20000000-0000-4000-8000-000000000042', // Kamera xira
    },

    // Vivo X100 Pro mappings
    {
      id: '40000000-0000-4000-8000-000000000041',
      phone_category_id: '10000000-0000-4000-8000-000000000051', // X100 Pro
      problem_category_id: '20000000-0000-4000-8000-000000000011', // Ekran singan
    },
    {
      id: '40000000-0000-4000-8000-000000000042',
      phone_category_id: '10000000-0000-4000-8000-000000000051', // X100 Pro
      problem_category_id: '20000000-0000-4000-8000-000000000032', // Mikrofon ishlamaydi
    },
    {
      id: '40000000-0000-4000-8000-000000000043',
      phone_category_id: '10000000-0000-4000-8000-000000000051', // X100 Pro
      problem_category_id: '20000000-0000-4000-8000-000000000041', // Kamera ochilmaydi
    },

    // Additional iPhone 15 Plus mappings
    {
      id: '40000000-0000-4000-8000-000000000044',
      phone_category_id: '10000000-0000-4000-8000-000000000005', // iPhone 15 Plus
      problem_category_id: '20000000-0000-4000-8000-000000000011', // Ekran singan
    },
    {
      id: '40000000-0000-4000-8000-000000000045',
      phone_category_id: '10000000-0000-4000-8000-000000000005', // iPhone 15 Plus
      problem_category_id: '20000000-0000-4000-8000-000000000021', // Batareya tez tugaydi
    },
    {
      id: '40000000-0000-4000-8000-000000000046',
      phone_category_id: '10000000-0000-4000-8000-000000000005', // iPhone 15 Plus
      problem_category_id: '20000000-0000-4000-8000-000000000051', // Zaryadlanmaydi
    },

    // Additional iPhone 13 Pro Max mappings
    {
      id: '40000000-0000-4000-8000-000000000047',
      phone_category_id: '10000000-0000-4000-8000-000000000009', // iPhone 13 Pro Max
      problem_category_id: '20000000-0000-4000-8000-000000000012', // Ekran qora
    },
    {
      id: '40000000-0000-4000-8000-000000000048',
      phone_category_id: '10000000-0000-4000-8000-000000000009', // iPhone 13 Pro Max
      problem_category_id: '20000000-0000-4000-8000-000000000013', // Sensorli ekran ishlamaydi
    },
    {
      id: '40000000-0000-4000-8000-000000000049',
      phone_category_id: '10000000-0000-4000-8000-000000000009', // iPhone 13 Pro Max
      problem_category_id: '20000000-0000-4000-8000-000000000031', // Ovoz chiqmaydi
    },

    // Additional Samsung Galaxy S24+ mappings
    {
      id: '40000000-0000-4000-8000-000000000050',
      phone_category_id: '10000000-0000-4000-8000-000000000022', // Galaxy S24+
      problem_category_id: '20000000-0000-4000-8000-000000000011', // Ekran singan
    },
    {
      id: '40000000-0000-4000-8000-000000000051',
      phone_category_id: '10000000-0000-4000-8000-000000000022', // Galaxy S24+
      problem_category_id: '20000000-0000-4000-8000-000000000022', // Batareya almashtirish
    },
    {
      id: '40000000-0000-4000-8000-000000000052',
      phone_category_id: '10000000-0000-4000-8000-000000000022', // Galaxy S24+
      problem_category_id: '20000000-0000-4000-8000-000000000061', // WiFi ishlamaydi
    },

    // Additional Samsung Galaxy S23 Ultra mappings
    {
      id: '40000000-0000-4000-8000-000000000053',
      phone_category_id: '10000000-0000-4000-8000-000000000024', // Galaxy S23 Ultra
      problem_category_id: '20000000-0000-4000-8000-000000000011', // Ekran singan
    },
    {
      id: '40000000-0000-4000-8000-000000000054',
      phone_category_id: '10000000-0000-4000-8000-000000000024', // Galaxy S23 Ultra
      problem_category_id: '20000000-0000-4000-8000-000000000014', // Ekranda chiziqlar
    },
    {
      id: '40000000-0000-4000-8000-000000000055',
      phone_category_id: '10000000-0000-4000-8000-000000000024', // Galaxy S23 Ultra
      problem_category_id: '20000000-0000-4000-8000-000000000041', // Kamera ochilmaydi
    },

    // Additional Samsung Galaxy A34 mappings
    {
      id: '40000000-0000-4000-8000-000000000056',
      phone_category_id: '10000000-0000-4000-8000-000000000026', // Galaxy A34
      problem_category_id: '20000000-0000-4000-8000-000000000011', // Ekran singan
    },
    {
      id: '40000000-0000-4000-8000-000000000057',
      phone_category_id: '10000000-0000-4000-8000-000000000026', // Galaxy A34
      problem_category_id: '20000000-0000-4000-8000-000000000021', // Batareya tez tugaydi
    },
    {
      id: '40000000-0000-4000-8000-000000000058',
      phone_category_id: '10000000-0000-4000-8000-000000000026', // Galaxy A34
      problem_category_id: '20000000-0000-4000-8000-000000000071', // Telefon sekin ishlaydi
    },

    // Additional Oppo Reno 11 Pro mappings
    {
      id: '40000000-0000-4000-8000-000000000059',
      phone_category_id: '10000000-0000-4000-8000-000000000042', // Reno 11 Pro
      problem_category_id: '20000000-0000-4000-8000-000000000011', // Ekran singan
    },
    {
      id: '40000000-0000-4000-8000-000000000060',
      phone_category_id: '10000000-0000-4000-8000-000000000042', // Reno 11 Pro
      problem_category_id: '20000000-0000-4000-8000-000000000042', // Kamera xira
    },
    {
      id: '40000000-0000-4000-8000-000000000061',
      phone_category_id: '10000000-0000-4000-8000-000000000042', // Reno 11 Pro
      problem_category_id: '20000000-0000-4000-8000-000000000051', // Zaryadlanmaydi
    },

    // Additional Vivo V30 Pro mappings
    {
      id: '40000000-0000-4000-8000-000000000062',
      phone_category_id: '10000000-0000-4000-8000-000000000052', // V30 Pro
      problem_category_id: '20000000-0000-4000-8000-000000000011', // Ekran singan
    },
    {
      id: '40000000-0000-4000-8000-000000000063',
      phone_category_id: '10000000-0000-4000-8000-000000000052', // V30 Pro
      problem_category_id: '20000000-0000-4000-8000-000000000033', // Karnay buzilgan
    },
    {
      id: '40000000-0000-4000-8000-000000000064',
      phone_category_id: '10000000-0000-4000-8000-000000000052', // V30 Pro
      problem_category_id: '20000000-0000-4000-8000-000000000062', // Bluetooth ishlamaydi
    },
  ];

  for (const mapping of mappings) {
    await knex('phone_problem_mappings').insert({
      id: mapping.id,
      phone_category_id: mapping.phone_category_id,
      problem_category_id: mapping.problem_category_id,
    });
  }
};