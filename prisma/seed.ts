import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Restoran başlangıç verileri yükleniyor...');

  // 1. Yazıcıları Tanımla
  const kasaYazici = await prisma.printer.upsert({
    where: { id: 'printer-kasa' },
    update: {},
    create: {
      id: 'printer-kasa',
      name: 'Kasa Yazıcı (USB)',
      type: 'USB',
      usbDeviceName: 'Afanda 892E',
      paperWidth: 80,
      isBillPrinter: true,
      isKitchen: false,
    },
  });

  const firinYazici = await prisma.printer.upsert({
    where: { id: 'printer-firin' },
    update: {},
    create: {
      id: 'printer-firin',
      name: 'Fırın Yazıcı (Ethernet IP)',
      type: 'NETWORK',
      ipAddress: '192.168.1.201', // İleride ayarlardan değiştirilebilir
      port: 9100,
      paperWidth: 80,
      isBillPrinter: false,
      isKitchen: true,
    },
  });

  const ocakYazici = await prisma.printer.upsert({
    where: { id: 'printer-ocak' },
    update: {},
    create: {
      id: 'printer-ocak',
      name: 'Kebap Ocağı Yazıcı (Ethernet IP)',
      type: 'NETWORK',
      ipAddress: '192.168.1.202', // İleride ayarlardan değiştirilebilir
      port: 9100,
      paperWidth: 80,
      isBillPrinter: false,
      isKitchen: true,
    },
  });

  // 2. Bölgeleri ve Masaları Oluştur
  const salon = await prisma.section.upsert({
    where: { id: 'section-salon' },
    update: {},
    create: {
      id: 'section-salon',
      name: 'Salon',
      orderIndex: 1,
    },
  });

  const bahce = await prisma.section.upsert({
    where: { id: 'section-bahce' },
    update: {},
    create: {
      id: 'section-bahce',
      name: 'Bahçe',
      orderIndex: 2,
    },
  });

  const paket = await prisma.section.upsert({
    where: { id: 'section-paket' },
    update: {},
    create: {
      id: 'section-paket',
      name: 'Paket Servis',
      orderIndex: 3,
    },
  });

  // Masaları oluştur (Salon 1-12, Bahçe 1-12, Paket 1-5)
  for (let i = 1; i <= 12; i++) {
    await prisma.table.upsert({
      where: { id: `table-salon-${i}` },
      update: {},
      create: {
        id: `table-salon-${i}`,
        sectionId: salon.id,
        name: `Salon ${i}`,
        capacity: 4,
      },
    });

    await prisma.table.upsert({
      where: { id: `table-bahce-${i}` },
      update: {},
      create: {
        id: `table-bahce-${i}`,
        sectionId: bahce.id,
        name: `Bahçe ${i}`,
        capacity: 4,
      },
    });
  }

  for (let i = 1; i <= 5; i++) {
    await prisma.table.upsert({
      where: { id: `table-paket-${i}` },
      update: {},
      create: {
        id: `table-paket-${i}`,
        sectionId: paket.id,
        name: `Paket ${i}`,
        capacity: 1,
      },
    });
  }

  // 3. Kategorileri ve Yazıcı Eşleşmelerini Oluştur
  const katKebap = await prisma.category.upsert({
    where: { id: 'cat-kebap' },
    update: {},
    create: {
      id: 'cat-kebap',
      name: 'Kebaplar & Izgaralar',
      color: '#ef4444',
      orderIndex: 1,
      printerId: ocakYazici.id, // Doğrudan Kebap Ocağı Yazıcısına gider
    },
  });

  const katFirin = await prisma.category.upsert({
    where: { id: 'cat-firin' },
    update: {},
    create: {
      id: 'cat-firin',
      name: 'Pide & Lahmacun',
      color: '#f97316',
      orderIndex: 2,
      printerId: firinYazici.id, // Doğrudan Fırın Yazıcısına gider
    },
  });

  const katIcecek = await prisma.category.upsert({
    where: { id: 'cat-icecek' },
    update: {},
    create: {
      id: 'cat-icecek',
      name: 'İçecekler',
      color: '#06b6d4',
      orderIndex: 3,
      printerId: kasaYazici.id,
    },
  });

  const katTatli = await prisma.category.upsert({
    where: { id: 'cat-tatli' },
    update: {},
    create: {
      id: 'cat-tatli',
      name: 'Tatlılar',
      color: '#ec4899',
      orderIndex: 4,
      printerId: kasaYazici.id,
    },
  });

  // 4. Örnek Ürünler
  const p1 = await prisma.product.upsert({
    where: { id: 'prod-adana' },
    update: {},
    create: {
      id: 'prod-adana',
      categoryId: katKebap.id,
      name: 'Adana Kebap (Porsiyon)',
      price: 320,
      preparationMin: 15,
    },
  });

  const p2 = await prisma.product.upsert({
    where: { id: 'prod-urfa' },
    update: {},
    create: {
      id: 'prod-urfa',
      categoryId: katKebap.id,
      name: 'Urfa Kebap (Porsiyon)',
      price: 320,
      preparationMin: 15,
    },
  });

  const p3 = await prisma.product.upsert({
    where: { id: 'prod-lahmacun' },
    update: {},
    create: {
      id: 'prod-lahmacun',
      categoryId: katFirin.id,
      name: 'Gaziantep Lahmacun',
      price: 110,
      preparationMin: 8,
    },
  });

  const p4 = await prisma.product.upsert({
    where: { id: 'prod-kusbasi-pide' },
    update: {},
    create: {
      id: 'prod-kusbasi-pide',
      categoryId: katFirin.id,
      name: 'Kuşbaşılı Kaşarlı Pide',
      price: 280,
      preparationMin: 12,
    },
  });

  const p5 = await prisma.product.upsert({
    where: { id: 'prod-kunefe' },
    update: {},
    create: {
      id: 'prod-kunefe',
      categoryId: katTatli.id,
      name: 'Antep Fıstıklı Künefe',
      price: 180,
      preparationMin: 10,
    },
  });

  const p6 = await prisma.product.upsert({
    where: { id: 'prod-ayran' },
    update: {},
    create: {
      id: 'prod-ayran',
      categoryId: katIcecek.id,
      name: 'Açık Yayık Ayranı',
      price: 40,
    },
  });

  // 5. Garson ve Yönetici Kullanıcıları
  await prisma.employee.upsert({
    where: { id: 'emp-admin' },
    update: {},
    create: {
      id: 'emp-admin',
      fullName: 'Taha Usta (Yönetici)',
      role: 'ADMIN',
      pinCode: '1234',
      qrToken: 'ADMIN-SECRET-QR-2026',
    },
  });

  await prisma.employee.upsert({
    where: { id: 'emp-garson-1' },
    update: {},
    create: {
      id: 'emp-garson-1',
      fullName: 'Ahmet Yılmaz (Garson)',
      role: 'WAITER',
      pinCode: '1111',
      qrToken: 'WAITER-AHMET-TOKEN-8912',
    },
  });

  console.log('✅ Restoran başlangıç verileri başarıyla yüklendi!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
