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
    await enrichV4Catalogs(existingMoc.id, ownerMoc.id, existingGom.id, ownerGom.id);
    console.info("V4 demo seed already present; enriched catalogs idempotently (ca-phe-moc, xuong-gom-an-nhien).");
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

    return { mocSlug: moc.slug, gomSlug: gom.slug, mocId: moc.id, gomId: gom.id };
  });

  await enrichV4Catalogs(result.mocId, ownerMoc.id, result.gomId, ownerGom.id);
  console.info("V4 demo seed created:", { mocSlug: result.mocSlug, gomSlug: result.gomSlug });
}

type CatalogSeedItem = {
  sku: string;
  categorySlug: string;
  name: string;
  description: string;
  richDescription?: string;
  price: string;
  imageUrl: string;
  lowStockThreshold?: number;
  initialQuantity: number;
};

async function upsertCategory(
  tx: Prisma.TransactionClient,
  merchantId: number,
  slug: string,
  name: string,
  sortOrder: number,
) {
  return tx.productCategory.upsert({
    where: { merchantId_slug: { merchantId, slug } },
    update: { name, sortOrder },
    create: { merchantId, slug, name, sortOrder },
  });
}

async function ensureCatalogProduct(
  tx: Prisma.TransactionClient,
  merchantId: number,
  actorId: number,
  categoryId: number,
  item: CatalogSeedItem,
) {
  const existing = await tx.product.findUnique({
    where: { merchantId_sku: { merchantId, sku: item.sku } },
    include: { images: true, inventoryBalance: true },
  });
  if (existing) {
    if (existing.categoryId !== categoryId || existing.imageUrl !== item.imageUrl) {
      await tx.product.update({
        where: { id: existing.id },
        data: { categoryId, imageUrl: item.imageUrl },
      });
    }
    return existing;
  }

  const product = await tx.product.create({
    data: {
      merchantId,
      categoryId,
      sku: item.sku,
      name: item.name,
      description: item.description,
      richDescription: item.richDescription ?? item.description,
      price: item.price,
      imageUrl: item.imageUrl,
      lowStockThreshold: item.lowStockThreshold ?? 5,
      status: "ACTIVE",
      kind: "SALE",
    },
  });
  await tx.productImage.create({
    data: { productId: product.id, merchantId, url: item.imageUrl, altText: item.name, sortOrder: 0 },
  });
  await createInventoryBalance(
    tx,
    { merchantId, ownerType: "SALE_PRODUCT", productId: product.id },
    item.initialQuantity,
    actorId,
  );
  return product;
}

async function enrichV4Catalogs(mocId: number, mocOwnerId: number, gomId: number, gomOwnerId: number) {
  await prisma.$transaction(async (tx) => {
    const mocCats = {
      "ca-phe-truyen-thong": (await upsertCategory(tx, mocId, "ca-phe-truyen-thong", "Cà phê truyền thống", 0)).id,
      "ca-phe-sang-tao": (await upsertCategory(tx, mocId, "ca-phe-sang-tao", "Cà phê sáng tạo", 1)).id,
      "tra-do-uong": (await upsertCategory(tx, mocId, "tra-do-uong", "Trà & đồ uống", 2)).id,
      "banh-ngot": (await upsertCategory(tx, mocId, "banh-ngot", "Bánh ngọt", 3)).id,
    };

    const mocProducts: CatalogSeedItem[] = [
      { sku: "MOC-TR-01", categorySlug: "ca-phe-truyen-thong", name: "Cà Phê Sữa Đá Sài Gòn", price: "35000", imageUrl: "/images/demo-products/ca-phe-sua-da.svg", initialQuantity: 30, description: "Phin Robusta đậm vị hòa quyện sữa đặc truyền thống." },
      { sku: "MOC-TR-02", categorySlug: "ca-phe-truyen-thong", name: "Bạc Xỉu Đá Mộc", price: "39000", imageUrl: "/images/demo-products/bac-xiu.svg", initialQuantity: 24, description: "Sữa tươi béo nhẹ điểm chút cốt cà phê rang mộc." },
      { sku: "MOC-LT-01", categorySlug: "ca-phe-truyen-thong", name: "Cà Phê Latte", price: "45000", imageUrl: "/images/demo-products/latte.jpg", initialQuantity: 3, description: "Espresso đậm đà kết hợp sữa tươi thanh trùng." },
      { sku: "MOC-CB-01", categorySlug: "ca-phe-sang-tao", name: "Cold Brew Cam Sả", price: "49000", imageUrl: "/images/demo-products/cold-brew-orange.png", initialQuantity: 25, description: "Ủ lạnh 16 giờ cùng cam vàng và sả tươi." },
      { sku: "MOC-ST-02", categorySlug: "ca-phe-sang-tao", name: "Espresso Tonic Chanh Vàng", price: "52000", imageUrl: "/images/demo-products/espresso-tonic.svg", initialQuantity: 16, description: "Cà phê đặc sản kết hợp tonic mát lạnh sảng khoái." },
      { sku: "MOC-MC-01", categorySlug: "tra-do-uong", name: "Matcha Latte Uji", price: "52000", imageUrl: "/images/demo-products/matcha-latte.jpg", initialQuantity: 12, description: "Bột trà xanh Nhật Bản nguyên chất." },
      { sku: "MOC-TD-02", categorySlug: "tra-do-uong", name: "Trà Đào Cam Sả", price: "45000", imageUrl: "/images/demo-products/tra-dao-cam-sa.svg", initialQuantity: 22, description: "Trà đen ủ lạnh cùng miếng đào giòn và hương sả dịu." },
      { sku: "MOC-TD-03", categorySlug: "tra-do-uong", name: "Trà Sen Vàng Kem Phô Mai", price: "49000", imageUrl: "/images/demo-products/tra-sen-vang.svg", initialQuantity: 18, description: "Trà ô long thanh nhẹ cùng hạt sen bùi và lớp kem mặn." },
      { sku: "MOC-CR-01", categorySlug: "banh-ngot", name: "Bánh Sừng Bò Bơ Pháp", price: "35000", imageUrl: "/images/demo-products/croissant.jpg", initialQuantity: 18, description: "Nướng mới mỗi sáng với lớp vỏ giòn rụm." },
      { sku: "MOC-BN-02", categorySlug: "banh-ngot", name: "Tiramisu Cacao Mộc", price: "55000", imageUrl: "/images/demo-products/tiramisu.svg", initialQuantity: 10, description: "Bánh lạnh mascarpone thấm đẫm hương espresso." },
      { sku: "MOC-BN-03", categorySlug: "banh-ngot", name: "Bánh Mì Bơ Tỏi Phô Mai", price: "42000", imageUrl: "/images/demo-products/banh-bo-toi.svg", initialQuantity: 14, description: "Nướng giòn thơm mùi bơ tỏi béo ngậy." },
    ];
    for (const item of mocProducts) {
      await ensureCatalogProduct(tx, mocId, mocOwnerId, mocCats[item.categorySlug as keyof typeof mocCats], item);
    }

    const gomCats = {
      "ly-tach-thu-cong": (await upsertCategory(tx, gomId, "ly-tach-thu-cong", "Ly/cốc gốm", 0)).id,
      "bat-dia": (await upsertCategory(tx, gomId, "bat-dia", "Bát/đĩa", 1)).id,
      "binh-hoa": (await upsertCategory(tx, gomId, "binh-hoa", "Bình hoa", 2)).id,
      "phu-kien-gom": (await upsertCategory(tx, gomId, "phu-kien-gom", "Phụ kiện gốm", 3)).id,
    };

    const gomProducts: CatalogSeedItem[] = [
      { sku: "GOM-MUG-01", categorySlug: "ly-tach-thu-cong", name: "Cốc Gốm Men Tro", price: "185000", imageUrl: "/images/demo-products/ceramic-mug.jpg", initialQuantity: 18, lowStockThreshold: 4, description: "Nung lò củi 1280 độ, men tro tự nhiên không chì." },
      { sku: "GOM-LY-02", categorySlug: "ly-tach-thu-cong", name: "Ly Espresso Men Mộc", price: "135000", imageUrl: "/images/demo-products/gom-ly-espresso.svg", initialQuantity: 20, description: "Dung tích 90ml giữ nhiệt tốt cho espresso buổi sáng." },
      { sku: "GOM-LY-03", categorySlug: "ly-tach-thu-cong", name: "Chén Trà Men Nhật Tro", price: "110000", imageUrl: "/images/demo-products/gom-chen-tra.svg", initialQuantity: 15, description: "Dáng chén cầm vừa tay, vân men tự nhiên mộc mạc." },
      { sku: "GOM-BD-01", categorySlug: "bat-dia", name: "Bát Cơm Men Rạn Cổ", price: "145000", imageUrl: "/images/demo-products/gom-bat-com.svg", initialQuantity: 24, description: "Men rạn thủ công an toàn dùng trong máy rửa chén." },
      { sku: "GOM-BD-02", categorySlug: "bat-dia", name: "Đĩa Tròn Thủ Công 22cm", price: "210000", imageUrl: "/images/demo-products/gom-dia-tron.svg", initialQuantity: 12, description: "Đĩa gốm viền mộc phù hợp bày bánh hoặc món chính." },
      { sku: "GOM-VASE-01", categorySlug: "binh-hoa", name: "Bình Hoa Đất Nung Mộc", price: "320000", imageUrl: "/images/ceramics-market.jpg", initialQuantity: 2, description: "Chế tác bàn xoay thủ công, mỗi sản phẩm là duy nhất." },
      { sku: "GOM-BH-02", categorySlug: "binh-hoa", name: "Bình Hoa Cổ Cao Men Xanh", price: "380000", imageUrl: "/images/demo-products/gom-binh-su.svg", initialQuantity: 7, description: "Phù hợp cắm cành khô hoặc hoa tươi dáng cao." },
      { sku: "GOM-PK-01", categorySlug: "phu-kien-gom", name: "Đế Lót Ly Gốm Thấm Nước", price: "65000", imageUrl: "/images/demo-products/gom-khay-lot.svg", initialQuantity: 30, description: "Chất đất nung thấm hút hơi nước bảo vệ mặt bàn." },
      { sku: "GOM-PK-02", categorySlug: "phu-kien-gom", name: "Hũ Đựng Trà Nắp Gỗ", price: "260000", imageUrl: "/images/demo-products/gom-hu-tra.svg", initialQuantity: 9, description: "Nắp gỗ kín khí giúp bảo quản trà và hạt cà phê." },
    ];
    for (const item of gomProducts) {
      await ensureCatalogProduct(tx, gomId, gomOwnerId, gomCats[item.categorySlug as keyof typeof gomCats], item);
    }
    const now = new Date();
    const startsAt = new Date(now.getTime() - 14 * 86400000);
    const endsAt = new Date(now.getTime() + 30 * 86400000);
    const ensureChallenge = async (merchantId: number, data: { title: string; type: "ORDER_COUNT" | "DAILY_CHECKIN" | "SPEND_TOTAL"; target: string; reward: string; budget: string; featured?: boolean }) => {
      const existing = await tx.challenge.findFirst({ where: { merchantId, title: data.title } });
      if (data.featured) await tx.challenge.updateMany({ where: { merchantId, isFeatured: true, ...(existing ? { id: { not: existing.id } } : {}) }, data: { isFeatured: false } });
      return existing ?? tx.challenge.create({ data: { merchantId, title: data.title, description: data.title, type: data.type, status: "ACTIVE", targetValue: data.target, rewardPoints: data.reward, budgetTotal: data.budget, startsAt, endsAt, isFeatured: data.featured ?? false, activatedAt: now } });
    };
    const orderChallenge = await ensureChallenge(mocId, { title: "Mộc thân quen: 3 đơn hàng", type: "ORDER_COUNT", target: "3", reward: "15", budget: "1500", featured: true });
    await ensureChallenge(mocId, { title: "Check-in mỗi ngày", type: "DAILY_CHECKIN", target: "5", reward: "10", budget: "1000" });
    await ensureChallenge(mocId, { title: "Chi tiêu tại Mộc", type: "SPEND_TOTAL", target: "500000", reward: "25", budget: "2500" });
    await ensureChallenge(gomId, { title: "Ghé xưởng gốm", type: "ORDER_COUNT", target: "2", reward: "20", budget: "1000" });
    const memberLan = await tx.user.findUnique({ where: { email: "member.lan@incomsg.local" }, select: { id: true } });
    if (memberLan) {
      const membership = await tx.merchantMembership.upsert({ where: { memberId_merchantId: { memberId: memberLan.id, merchantId: mocId } }, create: { memberId: memberLan.id, merchantId: mocId }, update: {} });
      await tx.challengeProgress.upsert({ where: { challengeId_membershipId: { challengeId: orderChallenge.id, membershipId: membership.id } }, create: { challengeId: orderChallenge.id, membershipId: membership.id, currentValue: "2" }, update: {} });
    }
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
