import "dotenv/config";
import { Prisma } from "../src/generated/prisma/client.js";
import { hashPassword } from "../src/lib/password.js";
import { prisma } from "../src/lib/prisma.js";
import { createInventoryBalance } from "../src/modules/inventory/inventory.persistence.js";

function assertLocalMysql(): void {
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (url.protocol !== "mysql:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("V4 demo seed only runs against a local MySQL database.");
  }
}

async function ensureUser(email: string, passwordHash: string, role: "ADMIN" | "MERCHANT" | "MEMBER") {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  return prisma.user.create({
    data: { email, passwordHash, role, accountStatus: "ACTIVE" },
  });
}

async function main(): Promise<void> {
  assertLocalMysql();
  const demoPassword = process.env.DEMO_PASSWORD ?? "IncomSGV4Demo!2026";
  if (demoPassword.length < 12) throw new Error("DEMO_PASSWORD must be at least 12 characters");
  const passwordHash = await hashPassword(demoPassword);

  const admin = await ensureUser("admin.v4@incomsg.local", passwordHash, "ADMIN");
  const ownerMoc = await ensureUser("owner.moc@incomsg.local", passwordHash, "MERCHANT");
  const ownerGom = await ensureUser("owner.gom@incomsg.local", passwordHash, "MERCHANT");
  const memberLan = await ensureUser("member.lan@incomsg.local", passwordHash, "MEMBER");
  const memberMinh = await ensureUser("member.minh@incomsg.local", passwordHash, "MEMBER");
  const memberHuy = await ensureUser("member.huy@incomsg.local", passwordHash, "MEMBER");

  const existingMoc = await prisma.merchant.findUnique({ where: { slug: "ca-phe-moc" } });
  const existingGom = await prisma.merchant.findUnique({ where: { slug: "xuong-gom-an-nhien" } });

  if (existingMoc && existingGom) {
    console.info("V4 demo seed already present (ca-phe-moc, xuong-gom-an-nhien); skipping duplicate seed.");
    return;
  }

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const upcomingStart1 = new Date(now.getTime() + 3 * dayMs);
  const upcomingEnd1 = new Date(upcomingStart1.getTime() + 3 * 60 * 60 * 1000);
  const upcomingStart2 = new Date(now.getTime() + 5 * dayMs);
  const upcomingEnd2 = new Date(upcomingStart2.getTime() + 4 * 60 * 60 * 1000);

  const result = await prisma.$transaction(async (tx) => {
    // Merchant 1: Tiem Ca Phe Moc
    await tx.merchantApplication.upsert({
      where: { applicantId: ownerMoc.id },
      update: {},
      create: {
        applicantId: ownerMoc.id,
        storeName: "Tiệm Cà Phê Mộc",
        slug: "ca-phe-moc",
        status: "APPROVED",
        reviewedById: admin.id,
        reviewedAt: now,
      },
    });
    const moc = await tx.merchant.upsert({
      where: { ownerId: ownerMoc.id },
      update: {},
      create: { ownerId: ownerMoc.id, name: "Tiệm Cà Phê Mộc", slug: "ca-phe-moc", isActive: true },
    });

    await tx.loyaltyRule.upsert({
      where: { merchantId: moc.id },
      update: {},
      create: { merchantId: moc.id, vndPerPoint: 10000, isActive: true },
    });
    const mocBronze = await tx.loyaltyTier.upsert({
      where: { merchantId_level: { merchantId: moc.id, level: "BRONZE" } },
      update: {},
      create: { merchantId: moc.id, level: "BRONZE", minLifetimePoints: 0, multiplier: "1.00" },
    });
    await tx.loyaltyTier.upsert({
      where: { merchantId_level: { merchantId: moc.id, level: "SILVER" } },
      update: {},
      create: { merchantId: moc.id, level: "SILVER", minLifetimePoints: 100, multiplier: "1.20" },
    });
    await tx.loyaltyTier.upsert({
      where: { merchantId_level: { merchantId: moc.id, level: "GOLD" } },
      update: {},
      create: { merchantId: moc.id, level: "GOLD", minLifetimePoints: 500, multiplier: "1.50" },
    });
    await tx.loyaltyTier.upsert({
      where: { merchantId_level: { merchantId: moc.id, level: "PLATINUM" } },
      update: {},
      create: { merchantId: moc.id, level: "PLATINUM", minLifetimePoints: 1000, multiplier: "2.00" },
    });

    const catCoffee = await tx.productCategory.create({
      data: { merchantId: moc.id, name: "Cà phê rang xay", slug: "ca-phe-rang-xay", sortOrder: 0 },
    });
    const catPastry = await tx.productCategory.create({
      data: { merchantId: moc.id, name: "Bánh ngọt", slug: "banh-ngot", sortOrder: 1 },
    });

    const coldBrew = await tx.product.create({
      data: {
        merchantId: moc.id,
        categoryId: catCoffee.id,
        sku: "MOC-CB-01",
        name: "Cold Brew Cam Sả",
        description: "Ủ lạnh 16 giờ cùng cam vàng và sả tươi.",
        richDescription: "Hạt Arabica Cầu Đất rang vừa.\nỦ lạnh tự nhiên 16 giờ giúp vị thanh mát và hậu ngọt.",
        price: "49000",
        imageUrl: "/images/demo-products/cold-brew-orange.png",
        lowStockThreshold: 5,
      },
    });
    const latte = await tx.product.create({
      data: {
        merchantId: moc.id,
        categoryId: catCoffee.id,
        sku: "MOC-LT-01",
        name: "Cà Phê Latte",
        description: "Espresso đậm đà kết hợp sữa tươi thanh trùng.",
        price: "45000",
        imageUrl: "/images/demo-products/latte.jpg",
        lowStockThreshold: 5,
      },
    });
    const croissant = await tx.product.create({
      data: {
        merchantId: moc.id,
        categoryId: catPastry.id,
        sku: "MOC-CR-01",
        name: "Bánh Sừng Bò Bơ Pháp",
        description: "Nướng mới mỗi sáng với lớp vỏ giòn rụm.",
        price: "35000",
        imageUrl: "/images/demo-products/croissant.jpg",
        lowStockThreshold: 5,
      },
    });
    const matcha = await tx.product.create({
      data: {
        merchantId: moc.id,
        categoryId: catCoffee.id,
        sku: "MOC-MC-01",
        name: "Matcha Latte Uji",
        description: "Bột trà xanh Nhật Bản nguyên chất.",
        price: "52000",
        imageUrl: "/images/demo-products/matcha-latte.jpg",
        lowStockThreshold: 5,
      },
    });

    await tx.productImage.createMany({
      data: [
        { productId: coldBrew.id, merchantId: moc.id, url: "/images/demo-products/cold-brew-orange.png", altText: "Cold Brew Cam Sả", sortOrder: 0 },
        { productId: coldBrew.id, merchantId: moc.id, url: "/images/demo-products/latte.jpg", altText: "Góc pha chế Mộc", sortOrder: 1 },
        { productId: latte.id, merchantId: moc.id, url: "/images/demo-products/latte.jpg", altText: "Cà Phê Latte", sortOrder: 0 },
        { productId: croissant.id, merchantId: moc.id, url: "/images/demo-products/croissant.jpg", altText: "Bánh Sừng Bò", sortOrder: 0 },
        { productId: matcha.id, merchantId: moc.id, url: "/images/demo-products/matcha-latte.jpg", altText: "Matcha Latte", sortOrder: 0 },
      ],
    });

    await createInventoryBalance(tx, { merchantId: moc.id, ownerType: "SALE_PRODUCT", productId: coldBrew.id }, 25, ownerMoc.id);
    await createInventoryBalance(tx, { merchantId: moc.id, ownerType: "SALE_PRODUCT", productId: latte.id }, 3, ownerMoc.id);
    await createInventoryBalance(tx, { merchantId: moc.id, ownerType: "SALE_PRODUCT", productId: croissant.id }, 18, ownerMoc.id);
    await createInventoryBalance(tx, { merchantId: moc.id, ownerType: "SALE_PRODUCT", productId: matcha.id }, 12, ownerMoc.id);

    const mocDiscount = await tx.voucherDefinition.create({
      data: { merchantId: moc.id, title: "Giảm 10.000đ hóa đơn", type: "DISCOUNT", pointsCost: 5, discountAmount: "10000" },
    });
    await createInventoryBalance(tx, { merchantId: moc.id, ownerType: "DISCOUNT_VOUCHER", voucherDefinitionId: mocDiscount.id }, 50, ownerMoc.id);

    const mocConfig = {
      branding: {
        logoUrl: "/images/independent-cafe.jpg",
        bannerUrl: "/images/independent-cafe.jpg",
        primaryColor: "#335e3d",
        heroTitle: "Hương vị cà phê nguyên bản mỗi sáng",
        heroDescription: "Rang mộc thủ công và bánh tươi nướng mỗi ngày tại trung tâm Sài Gòn.",
        heroImageUrl: "/images/independent-cafe.jpg",
        heroCtaText: "Khám phá thực đơn",
        heroCtaLink: "/s/ca-phe-moc",
        footerDescription: "Tiệm Cà Phê Mộc — Không gian thư giãn cùng bạn bè.",
        contactEmail: "hello@caphemoc.local",
        contactPhone: "0909123456",
        address: "123 Lê Lợi, Quận 1, TP.HCM",
        allowedLinks: [
          { label: "Sản phẩm", url: "/s/ca-phe-moc" },
          { label: "Sự kiện", url: "/s/ca-phe-moc/events" },
        ],
      },
      sections: [
        { key: "hero", enabled: true, order: 0, title: null, subtitle: null },
        { key: "featured_products", enabled: true, order: 1, title: "Món được yêu thích", subtitle: "Pha chế tươi mỗi ngày" },
        { key: "categories", enabled: true, order: 2, title: "Danh mục", subtitle: null },
        { key: "upcoming_events", enabled: true, order: 3, title: "Workshop & Cộng đồng", subtitle: null },
        { key: "store_info", enabled: true, order: 4, title: "Ghé Tiệm Mộc", subtitle: null },
        { key: "footer", enabled: true, order: 5, title: null, subtitle: null },
      ],
      featuredProductIds: [coldBrew.id, latte.id, croissant.id],
    };

    await tx.storefrontDraft.create({ data: { merchantId: moc.id, config: mocConfig, updatedById: ownerMoc.id } });
    await tx.storefrontConfigVersion.create({
      data: {
        merchantId: moc.id,
        version: 1,
        config: mocConfig,
        isPublished: true,
        source: "PUBLISH",
        note: "Khởi tạo cửa hàng Mộc",
        publishedById: ownerMoc.id,
      },
    });

    await tx.merchantEvent.createMany({
      data: [
        {
          merchantId: moc.id,
          title: "Workshop Pour Over Cuối Tuần",
          slug: "workshop-pour-over-cuoi-tuan",
          description: "Cùng Barista tìm hiểu cách kiểm soát nhiệt độ nước và dòng chảy V60.\nBao gồm trải nghiệm 3 dòng hạt đặc sản.",
          bannerUrl: "/images/independent-cafe.jpg",
          startAt: upcomingStart1,
          endAt: upcomingEnd1,
          locationName: "Tiệm Cà Phê Mộc - Tầng 2",
          locationAddress: "123 Lê Lợi, Quận 1, TP.HCM",
          status: "PUBLISHED",
          publishedAt: now,
        },
        {
          merchantId: moc.id,
          title: "Bản nháp: Tiệc tri ân cuối năm",
          slug: "nhap-tiec-tri-an",
          description: "Sự kiện nội bộ đang chuẩn bị nội dung.",
          startAt: upcomingStart2,
          endAt: upcomingEnd2,
          locationName: "Tiệm Cà Phê Mộc",
          status: "DRAFT",
        },
      ],
    });

    // Seed Lan (2 PAID orders at Moc -> returning customer) & Minh (1 PAID + 1 REFUND_PENDING at Moc)
    const lanMoc = await tx.merchantMembership.create({
      data: { memberId: memberLan.id, merchantId: moc.id, tierId: mocBronze.id },
    });
    const lanWallet = await tx.loyaltyWallet.create({
      data: { membershipId: lanMoc.id, exactBalance: new Prisma.Decimal("13.3"), netLifetimeEarned: new Prisma.Decimal("13.3") },
    });
    const o1 = await tx.order.create({
      data: {
        merchantId: moc.id,
        memberId: memberLan.id,
        status: "PAID",
        subtotal: "98000",
        discountAmount: "0",
        total: "98000",
        earnedPointsExact: new Prisma.Decimal("9.8"),
        paidAt: new Date(now.getTime() - 3 * dayMs),
        items: { create: { productId: coldBrew.id, productName: coldBrew.name, unitPrice: "49000", quantity: 2, lineTotal: "98000" } },
      },
    });
    const o2 = await tx.order.create({
      data: {
        merchantId: moc.id,
        memberId: memberLan.id,
        status: "PAID",
        subtotal: "35000",
        discountAmount: "0",
        total: "35000",
        earnedPointsExact: new Prisma.Decimal("3.5"),
        paidAt: new Date(now.getTime() - 1 * dayMs),
        items: { create: { productId: croissant.id, productName: croissant.name, unitPrice: "35000", quantity: 1, lineTotal: "35000" } },
      },
    });
    await tx.pointTransaction.createMany({
      data: [
        { walletId: lanWallet.id, type: "EARN", delta: new Prisma.Decimal("9.8"), balanceAfter: new Prisma.Decimal("9.8"), promotedToTier: "BRONZE", reason: "Đơn hàng #1", source: "MOCK_PAYMENT", orderId: o1.id, createdAt: new Date(now.getTime() - 3 * dayMs) },
        { walletId: lanWallet.id, type: "EARN", delta: new Prisma.Decimal("3.5"), balanceAfter: new Prisma.Decimal("13.3"), reason: "Đơn hàng #2", source: "MOCK_PAYMENT", orderId: o2.id, createdAt: new Date(now.getTime() - 1 * dayMs) },
      ],
    });

    const minhMoc = await tx.merchantMembership.create({
      data: { memberId: memberMinh.id, merchantId: moc.id, tierId: mocBronze.id },
    });
    const minhWallet = await tx.loyaltyWallet.create({
      data: { membershipId: minhMoc.id, exactBalance: new Prisma.Decimal("9"), netLifetimeEarned: new Prisma.Decimal("9") },
    });
    const o3 = await tx.order.create({
      data: {
        merchantId: moc.id,
        memberId: memberMinh.id,
        status: "PAID",
        subtotal: "45000",
        discountAmount: "0",
        total: "45000",
        earnedPointsExact: new Prisma.Decimal("4.5"),
        paidAt: new Date(now.getTime() - 2 * dayMs),
        items: { create: { productId: latte.id, productName: latte.name, unitPrice: "45000", quantity: 1, lineTotal: "45000" } },
      },
    });
    const o4 = await tx.order.create({
      data: {
        merchantId: moc.id,
        memberId: memberMinh.id,
        status: "REFUND_PENDING",
        subtotal: "45000",
        discountAmount: "0",
        total: "45000",
        earnedPointsExact: new Prisma.Decimal("4.5"),
        paidAt: new Date(now.getTime() - 1 * dayMs),
        items: { create: { productId: latte.id, productName: latte.name, unitPrice: "45000", quantity: 1, lineTotal: "45000" } },
        refund: { create: { status: "PENDING_PROVIDER", amountVnd: "45000", reason: "Khách đổi món", requestedById: ownerMoc.id } },
      },
    });
    await tx.pointTransaction.createMany({
      data: [
        { walletId: minhWallet.id, type: "EARN", delta: new Prisma.Decimal("4.5"), balanceAfter: new Prisma.Decimal("4.5"), promotedToTier: "BRONZE", reason: "Đơn hàng #3", source: "MOCK_PAYMENT", orderId: o3.id, createdAt: new Date(now.getTime() - 2 * dayMs) },
        { walletId: minhWallet.id, type: "EARN", delta: new Prisma.Decimal("4.5"), balanceAfter: new Prisma.Decimal("9"), reason: "Đơn hàng #4", source: "MOCK_PAYMENT", orderId: o4.id, createdAt: new Date(now.getTime() - 1 * dayMs) },
      ],
    });

    // Merchant 2: Xuong Gom An Nhien
    await tx.merchantApplication.upsert({
      where: { applicantId: ownerGom.id },
      update: {},
      create: {
        applicantId: ownerGom.id,
        storeName: "Xưởng Gốm An Nhiên",
        slug: "xuong-gom-an-nhien",
        status: "APPROVED",
        reviewedById: admin.id,
        reviewedAt: now,
      },
    });
    const gom = await tx.merchant.upsert({
      where: { ownerId: ownerGom.id },
      update: {},
      create: { ownerId: ownerGom.id, name: "Xưởng Gốm An Nhiên", slug: "xuong-gom-an-nhien", isActive: true },
    });

    await tx.loyaltyRule.upsert({
      where: { merchantId: gom.id },
      update: {},
      create: { merchantId: gom.id, vndPerPoint: 20000, isActive: true },
    });
    const gomBronze = await tx.loyaltyTier.upsert({
      where: { merchantId_level: { merchantId: gom.id, level: "BRONZE" } },
      update: {},
      create: { merchantId: gom.id, level: "BRONZE", minLifetimePoints: 0, multiplier: "1.00" },
    });

    const catMugs = await tx.productCategory.create({
      data: { merchantId: gom.id, name: "Ly tách thủ công", slug: "ly-tach-thu-cong", sortOrder: 0 },
    });
    const mug = await tx.product.create({
      data: {
        merchantId: gom.id,
        categoryId: catMugs.id,
        sku: "GOM-MUG-01",
        name: "Cốc Gốm Men Tro",
        description: "Nung lò củi 1280 độ, men tro tự nhiên không chì.",
        price: "185000",
        imageUrl: "/images/demo-products/ceramic-mug.jpg",
        lowStockThreshold: 4,
      },
    });
    const vase = await tx.product.create({
      data: {
        merchantId: gom.id,
        categoryId: catMugs.id,
        sku: "GOM-VASE-01",
        name: "Bình Hoa Đất Nung Mộc",
        description: "Chế tác bàn xoay thủ công, mỗi sản phẩm là duy nhất.",
        price: "320000",
        imageUrl: "/images/ceramics-market.jpg",
        lowStockThreshold: 5,
      },
    });
    await tx.productImage.createMany({
      data: [
        { productId: mug.id, merchantId: gom.id, url: "/images/demo-products/ceramic-mug.jpg", altText: "Cốc Gốm Men Tro", sortOrder: 0 },
        { productId: vase.id, merchantId: gom.id, url: "/images/ceramics-market.jpg", altText: "Bình Hoa Đất Nung", sortOrder: 0 },
      ],
    });
    await createInventoryBalance(tx, { merchantId: gom.id, ownerType: "SALE_PRODUCT", productId: mug.id }, 18, ownerGom.id);
    await createInventoryBalance(tx, { merchantId: gom.id, ownerType: "SALE_PRODUCT", productId: vase.id }, 2, ownerGom.id);

    const gomConfig = {
      branding: {
        logoUrl: "/images/ceramics-market.jpg",
        bannerUrl: "/images/ceramics-market.jpg",
        primaryColor: "#7c4a2d",
        heroTitle: "Gốm thủ công cho góc nhà an yên",
        heroDescription: "Từng chiếc ly và bình gốm được tạo hình trên bàn xoay tại xưởng An Nhiên.",
        heroImageUrl: "/images/ceramics-market.jpg",
        heroCtaText: "Xem bộ sưu tập",
        heroCtaLink: "/s/xuong-gom-an-nhien",
        footerDescription: "Xưởng Gốm An Nhiên — Gìn giữ nét mộc trong từng thớ đất.",
        contactEmail: "xinchao@annhien.local",
        contactPhone: "0908888999",
        address: "45 Thảo Điền, TP. Thủ Đức",
        allowedLinks: [
          { label: "Trang chủ", url: "/s/xuong-gom-an-nhien" },
          { label: "Triển lãm", url: "/s/xuong-gom-an-nhien/events" },
        ],
      },
      sections: [
        { key: "hero", enabled: true, order: 0, title: null, subtitle: null },
        { key: "categories", enabled: true, order: 1, title: "Dòng sản phẩm", subtitle: null },
        { key: "featured_products", enabled: true, order: 2, title: "Tác phẩm mới ra lò", subtitle: null },
        { key: "upcoming_events", enabled: true, order: 3, title: "Lịch triển lãm", subtitle: null },
        { key: "store_info", enabled: true, order: 4, title: "Địa chỉ xưởng", subtitle: null },
        { key: "footer", enabled: true, order: 5, title: null, subtitle: null },
      ],
      featuredProductIds: [mug.id, vase.id],
    };
    await tx.storefrontDraft.create({ data: { merchantId: gom.id, config: gomConfig, updatedById: ownerGom.id } });
    await tx.storefrontConfigVersion.create({
      data: {
        merchantId: gom.id,
        version: 1,
        config: gomConfig,
        isPublished: true,
        source: "PUBLISH",
        note: "Khởi tạo Xưởng Gốm An Nhiên",
        publishedById: ownerGom.id,
      },
    });
    await tx.merchantEvent.create({
      data: {
        merchantId: gom.id,
        title: "Triển lãm Gốm Thủ Công Mùa Thu",
        slug: "trien-lam-gom-thu-cong",
        description: "Trưng bày các mẫu men tro mới và hướng dẫn nặn gốm cơ bản.",
        bannerUrl: "/images/ceramics-market.jpg",
        startAt: upcomingStart2,
        endAt: upcomingEnd2,
        locationName: "Xưởng Gốm An Nhiên",
        locationAddress: "45 Thảo Điền, TP. Thủ Đức",
        status: "PUBLISHED",
        publishedAt: now,
      },
    });

    // Minh joins Gom with 0 orders (tests zero-order member in Customer 360)
    const minhGom = await tx.merchantMembership.create({
      data: { memberId: memberMinh.id, merchantId: gom.id, tierId: null },
    });
    await tx.loyaltyWallet.create({ data: { membershipId: minhGom.id } });

    // Huy buys at Gom only
    const huyGom = await tx.merchantMembership.create({
      data: { memberId: memberHuy.id, merchantId: gom.id, tierId: gomBronze.id },
    });
    const huyWallet = await tx.loyaltyWallet.create({
      data: { membershipId: huyGom.id, exactBalance: new Prisma.Decimal("9.25"), netLifetimeEarned: new Prisma.Decimal("9.25") },
    });
    const oGom1 = await tx.order.create({
      data: {
        merchantId: gom.id,
        memberId: memberHuy.id,
        status: "PAID",
        subtotal: "185000",
        discountAmount: "0",
        total: "185000",
        earnedPointsExact: new Prisma.Decimal("9.25"),
        paidAt: new Date(now.getTime() - 1 * dayMs),
        items: { create: { productId: mug.id, productName: mug.name, unitPrice: "185000", quantity: 1, lineTotal: "185000" } },
      },
    });
    await tx.pointTransaction.create({
      data: { walletId: huyWallet.id, type: "EARN", delta: new Prisma.Decimal("9.25"), balanceAfter: new Prisma.Decimal("9.25"), promotedToTier: "BRONZE", reason: "Đơn hàng gốm #1", source: "MOCK_PAYMENT", orderId: oGom1.id },
    });

    return { mocSlug: moc.slug, gomSlug: gom.slug };
  });

  console.info("V4 demo seed created:", result);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
