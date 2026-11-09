import type {
  Application,
  CheckoutInput,
  CommerceApi,
  LoyaltyConfig,
  MemberVoucher,
  Merchant,
  Order,
  Product,
  VoucherDefinition,
  Wallet,
} from "./types";

const pause = () => new Promise((resolve) => setTimeout(resolve, 260));
const clone = <T>(value: T): T => structuredClone(value);
const today = "2026-11-09";

export function createMockApi(): CommerceApi {
  const merchants: Merchant[] = [
    {
      id: "moc",
      name: "Mộc Studio",
      tagline: "Chút ấm áp cho mỗi ngày",
      category: "Lifestyle & Home",
      description: "Đồ dùng thủ công và những món quà nhỏ được chọn lựa kỹ càng cho góc sống của bạn.",
      location: "Quận 1, TP. Hồ Chí Minh",
      status: "APPROVED",
      color: "#c9dece",
      initials: "M",
    },
    {
      id: "hikari",
      name: "Hikari Coffee",
      tagline: "Cà phê cho nhịp sống mới",
      category: "Food & Beverage",
      description: "Một góc cà phê sáng, bánh thơm và những cuộc gặp gỡ dễ chịu.",
      location: "Thảo Điền, TP. Hồ Chí Minh",
      status: "APPROVED",
      color: "#e8d9c1",
      initials: "H",
    },
    {
      id: "gommay",
      name: "Gốm Mây",
      tagline: "Chạm vào sự bình yên",
      category: "Home & Decor",
      description: "Gốm thủ công cho tổ ấm của bạn.",
      location: "Hà Nội",
      status: "PENDING",
      color: "#d7d0e9",
      initials: "G",
    },
  ];
  const applications: Application[] = [
    {
      id: "a1",
      merchantId: "gommay",
      owner: "Nguyễn Thu Hà",
      email: "hello@gommay.vn",
      submittedAt: "2026-11-08",
      status: "PENDING",
      note: "Cửa hàng gốm thủ công, 12 dòng sản phẩm dự kiến.",
    },
  ];
  const products: Product[] = [
    {
      id: "p1",
      merchantId: "moc",
      name: "Bình gốm Sớm Mai",
      category: "Trang trí",
      description: "Bình gốm men mờ, dáng tự nhiên cho bàn làm việc.",
      price: 289000,
      stock: 18,
      active: true,
      image: "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?w=900&q=80",
    },
    {
      id: "p2",
      merchantId: "moc",
      name: "Nến thơm Gỗ & Mưa",
      category: "Hương thơm",
      description: "Hương gỗ dịu và chút hơi ấm sau cơn mưa.",
      price: 219000,
      stock: 27,
      active: true,
      image: "https://images.unsplash.com/photo-1603006905003-be475563bc59?w=900&q=80",
    },
    {
      id: "p3",
      merchantId: "moc",
      name: "Ly gốm Nâu Nhạt",
      category: "Đồ dùng",
      description: "Một chiếc ly vừa tay cho buổi sáng chậm rãi.",
      price: 179000,
      stock: 5,
      active: true,
      image: "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=900&q=80",
    },
    {
      id: "p4",
      merchantId: "hikari",
      name: "Hikari Signature Blend",
      category: "Cà phê",
      description: "Hạt rang vừa với hậu vị caramel nhẹ.",
      price: 168000,
      stock: 42,
      active: true,
      image: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=900&q=80",
    },
    {
      id: "p5",
      merchantId: "hikari",
      name: "Bánh bơ hạnh nhân",
      category: "Bánh ngọt",
      description: "Bánh nướng mỗi sáng, thơm bơ và hạnh nhân.",
      price: 69000,
      stock: 16,
      active: true,
      image: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=900&q=80",
    },
  ];
  const orders: Order[] = [
    {
      id: "LC-1042",
      merchantId: "moc",
      memberId: "member-demo",
      memberName: "Mai Anh",
      createdAt: "2026-11-08",
      items: [{ productId: "p1", name: "Bình gốm Sớm Mai", price: 289000, quantity: 1 }],
      subtotal: 289000,
      discount: 20000,
      total: 269000,
      status: "PAID",
      earnedPoints: 31,
      voucherId: "mv-used",
    },
    {
      id: "LC-1041",
      merchantId: "moc",
      memberId: "member-khang",
      memberName: "Minh Khang",
      createdAt: "2026-11-08",
      items: [{ productId: "p2", name: "Nến thơm Gỗ & Mưa", price: 219000, quantity: 1 }],
      subtotal: 219000,
      discount: 0,
      total: 219000,
      status: "PENDING",
      earnedPoints: 0,
    },
    {
      id: "LC-1038",
      merchantId: "hikari",
      memberId: "member-linhchi",
      memberName: "Linh Chi",
      createdAt: "2026-11-07",
      items: [{ productId: "p4", name: "Hikari Signature Blend", price: 168000, quantity: 2 }],
      subtotal: 336000,
      discount: 0,
      total: 336000,
      status: "PAID",
      earnedPoints: 33,
    },
  ];
  const wallets: Wallet[] = [
    {
      merchantId: "moc",
      availablePoints: 540,
      lifetimeEarnedPoints: 1840,
      tier: "Silver",
      transactions: [
        { id: "t1", reason: "Mua hàng LC-1042", amount: 31, date: "2026-11-08", reference: "LC-1042" },
        { id: "t2", reason: "Đổi voucher", amount: -200, date: "2026-11-06", reference: "MV-02" },
        { id: "t3", reason: "Mua hàng LC-1028", amount: 46, date: "2026-11-04", reference: "LC-1028" },
      ],
    },
    { merchantId: "hikari", availablePoints: 0, lifetimeEarnedPoints: 0, tier: "Unranked", transactions: [] },
  ];
  const configs: LoyaltyConfig[] = ["moc", "hikari"].map((merchantId) => ({
    merchantId,
    baseAmount: 10000,
    tiers: [
      { tier: "Bronze", threshold: 0, multiplier: 1 },
      { tier: "Silver", threshold: 1000, multiplier: 1.2 },
      { tier: "Gold", threshold: 5000, multiplier: 1.5 },
      { tier: "Platinum", threshold: 10000, multiplier: 2 },
    ],
  }));
  const definitions: VoucherDefinition[] = [
    {
      id: "v1",
      merchantId: "moc",
      title: "Giảm 20.000đ",
      description: "Cho đơn hàng tại Mộc Studio",
      kind: "DISCOUNT",
      pointsCost: 200,
      discountAmount: 20000,
      active: true,
      icon: "ticket",
    },
    {
      id: "v2",
      merchantId: "moc",
      title: "Ly gốm tặng bạn",
      description: "Đổi điểm lấy quyền nhận một chiếc ly gốm",
      kind: "REWARD",
      pointsCost: 500,
      active: true,
      icon: "gift",
    },
    {
      id: "v3",
      merchantId: "hikari",
      title: "Giảm 15.000đ",
      description: "Cho đơn hàng tại Hikari Coffee",
      kind: "DISCOUNT",
      pointsCost: 150,
      discountAmount: 15000,
      active: true,
      icon: "ticket",
    },
  ];
  const memberVouchers: MemberVoucher[] = [
    {
      id: "mv-1",
      definitionId: "v1",
      merchantId: "moc",
      memberId: "member-demo",
      title: "Giảm 20.000đ",
      kind: "DISCOUNT",
      status: "AVAILABLE",
      issuedAt: "2026-11-07",
    },
    {
      id: "mv-reward",
      definitionId: "v2",
      merchantId: "moc",
      memberId: "member-demo",
      title: "Ly gốm tặng bạn",
      kind: "REWARD",
      status: "PENDING_FULFILLMENT",
      issuedAt: "2026-11-06",
    },
    {
      id: "mv-other",
      definitionId: "v1",
      merchantId: "moc",
      memberId: "member-khang",
      title: "Giảm 20.000đ",
      kind: "DISCOUNT",
      status: "AVAILABLE",
      issuedAt: "2026-11-05",
    },
  ];

  const findMerchant = (id: string) => {
    const m = merchants.find((x) => x.id === id);
    if (!m) throw new Error("Không tìm thấy cửa hàng");
    return m;
  };
  const findWallet = (id: string) => {
    const w = wallets.find((x) => x.merchantId === id);
    if (!w) throw new Error("Không tìm thấy ví điểm");
    return w;
  };

  return {
    mode: "mock",
    async listMerchants() {
      await pause();
      return clone(merchants);
    },
    async getMerchant(id) {
      await pause();
      return clone(findMerchant(id));
    },
    async updateMerchant(id, changes) {
      await pause();
      const m = findMerchant(id);
      Object.assign(m, changes);
      return clone(m);
    },
    async listApplications() {
      await pause();
      return clone(applications);
    },
    async approveApplication(id) {
      await pause();
      const a = applications.find((x) => x.id === id);
      if (!a) throw new Error("Không tìm thấy hồ sơ");
      a.status = "APPROVED";
      findMerchant(a.merchantId).status = "APPROVED";
      if (!wallets.some((w) => w.merchantId === a.merchantId))
        wallets.push({
          merchantId: a.merchantId,
          availablePoints: 0,
          lifetimeEarnedPoints: 0,
          tier: "Unranked",
          transactions: [],
        });
      if (!configs.some((c) => c.merchantId === a.merchantId))
        configs.push({
          merchantId: a.merchantId,
          baseAmount: 10000,
          tiers: [
            { tier: "Bronze", threshold: 0, multiplier: 1 },
            { tier: "Silver", threshold: 1000, multiplier: 1.2 },
            { tier: "Gold", threshold: 5000, multiplier: 1.5 },
            { tier: "Platinum", threshold: 10000, multiplier: 2 },
          ],
        });
      return clone(a);
    },
    async rejectApplication(id) {
      await pause();
      const a = applications.find((x) => x.id === id);
      if (!a) throw new Error("Không tìm thấy hồ sơ");
      a.status = "REJECTED";
      findMerchant(a.merchantId).status = "REJECTED";
      return clone(a);
    },
    async canManageMerchant(id) {
      await pause();
      return findMerchant(id).status === "APPROVED";
    },
    async getDashboardStats() {
      await pause();
      return {
        merchants: merchants.filter((m) => m.status === "APPROVED").length,
        pendingApplications: applications.filter((a) => a.status === "PENDING").length,
        paidOrders: orders.filter((o) => o.status === "PAID").length,
        totalVolume: orders.filter((o) => o.status === "PAID").reduce((n, o) => n + o.total, 0),
      };
    },
    async listProducts(merchantId) {
      await pause();
      return clone(products.filter((p) => p.merchantId === merchantId));
    },
    async saveProduct(input) {
      await pause();
      if (!(await this.canManageMerchant(input.merchantId))) throw new Error("Cửa hàng chưa được duyệt");
      const existing = products.find((p) => p.id === input.id);
      if (input.id && (!existing || existing.merchantId !== input.merchantId))
        throw new Error("Không tìm thấy sản phẩm");
      if (existing) {
        Object.assign(existing, input);
        return clone(existing);
      }
      const p: Product = {
        id: `p${Date.now()}`,
        merchantId: input.merchantId,
        name: input.name,
        category: input.category ?? "Khác",
        description: input.description ?? "",
        price: input.price,
        stock: input.stock ?? 0,
        active: true,
        image: input.image ?? "",
      };
      products.unshift(p);
      return clone(p);
    },
    async toggleProduct(id, merchantId) {
      await pause();
      if (!(await this.canManageMerchant(merchantId))) throw new Error("Cửa hàng chưa được duyệt");
      const p = products.find((x) => x.id === id && x.merchantId === merchantId);
      if (!p) throw new Error("Không tìm thấy sản phẩm");
      p.active = !p.active;
      return clone(p);
    },
    async listOrders(merchantId) {
      await pause();
      return clone(merchantId ? orders.filter((o) => o.merchantId === merchantId) : orders);
    },
    async listMemberOrders(merchantId) {
      await pause();
      return clone(orders.filter((o) => o.merchantId === merchantId && o.memberId === "member-demo"));
    },
    async createOrder(input: CheckoutInput) {
      await pause();
      const merchant = findMerchant(input.merchantId);
      if (merchant.status !== "APPROVED") throw new Error("Cửa hàng chưa hoạt động");
      if (!input.items.length) throw new Error("Giỏ hàng trống");
      const items = input.items.map(({ productId, quantity }) => {
        const p = products.find((x) => x.id === productId && x.merchantId === input.merchantId && x.active);
        if (!p || quantity < 1 || quantity > p.stock) throw new Error("Sản phẩm không hợp lệ hoặc hết hàng");
        return { productId, name: p.name, price: p.price, quantity };
      });
      const voucher = input.voucherId
        ? memberVouchers.find(
            (v) =>
              v.id === input.voucherId &&
              v.merchantId === input.merchantId &&
              v.kind === "DISCOUNT" &&
              v.status === "AVAILABLE",
          )
        : undefined;
      if (input.voucherId && !voucher) throw new Error("Voucher không hợp lệ");
      const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
      const discount = voucher
        ? Math.min(subtotal, definitions.find((d) => d.id === voucher.definitionId)?.discountAmount ?? 0)
        : 0;
      const order: Order = {
        id: `LC-${Date.now().toString().slice(-6)}`,
        merchantId: input.merchantId,
        memberId: "member-demo",
        memberName: "Mai Anh",
        createdAt: today,
        items,
        subtotal,
        discount,
        total: subtotal - discount,
        status: "PENDING",
        earnedPoints: 0,
        voucherId: voucher?.id,
      };
      orders.unshift(order);
      return clone(order);
    },
    async getWallet(merchantId) {
      await pause();
      return clone(findWallet(merchantId));
    },
    async getLoyaltyConfig(merchantId) {
      await pause();
      const c = configs.find((x) => x.merchantId === merchantId);
      if (!c) throw new Error("Chưa có cấu hình loyalty");
      return clone(c);
    },
    async saveLoyaltyConfig(config) {
      await pause();
      if (!(await this.canManageMerchant(config.merchantId))) throw new Error("Cửa hàng chưa được duyệt");
      const index = configs.findIndex((x) => x.merchantId === config.merchantId);
      if (index < 0) configs.push(clone(config));
      else configs[index] = clone(config);
      return clone(config);
    },
    async listVoucherDefinitions(merchantId) {
      await pause();
      return clone(definitions.filter((v) => v.merchantId === merchantId));
    },
    async saveVoucherDefinition(input) {
      await pause();
      if (!(await this.canManageMerchant(input.merchantId))) throw new Error("Cửa hàng chưa được duyệt");
      const existing = definitions.find((v) => v.id === input.id);
      if (input.id && (!existing || existing.merchantId !== input.merchantId))
        throw new Error("Không tìm thấy voucher");
      if (existing) {
        Object.assign(existing, input);
        return clone(existing);
      }
      const v: VoucherDefinition = {
        id: `v${Date.now()}`,
        merchantId: input.merchantId,
        title: input.title,
        description: input.description ?? "",
        kind: input.kind,
        pointsCost: input.pointsCost,
        discountAmount: input.discountAmount,
        active: true,
        icon: input.kind === "DISCOUNT" ? "ticket" : "gift",
      };
      definitions.unshift(v);
      return clone(v);
    },
    async toggleVoucherDefinition(id, merchantId) {
      await pause();
      if (!(await this.canManageMerchant(merchantId))) throw new Error("Cửa hàng chưa được duyệt");
      const v = definitions.find((x) => x.id === id && x.merchantId === merchantId);
      if (!v) throw new Error("Không tìm thấy voucher");
      v.active = !v.active;
      return clone(v);
    },
    async listMemberVouchers(merchantId) {
      await pause();
      return clone(memberVouchers.filter((v) => v.merchantId === merchantId && v.memberId === "member-demo"));
    },
    async redeemVoucher(definitionId, merchantId) {
      await pause();
      const definition = definitions.find(
        (v) => v.id === definitionId && v.merchantId === merchantId && v.active,
      );
      if (!definition) throw new Error("Voucher không khả dụng tại cửa hàng này");
      const wallet = findWallet(merchantId);
      if (wallet.availablePoints < definition.pointsCost) throw new Error("Không đủ điểm để đổi voucher");
      wallet.availablePoints -= definition.pointsCost;
      wallet.transactions.unshift({
        id: `t${Date.now()}`,
        reason: `Đổi ${definition.title}`,
        amount: -definition.pointsCost,
        date: today,
        reference: definitionId,
      });
      const voucher: MemberVoucher = {
        id: `mv-${Date.now()}`,
        definitionId,
        merchantId: definition.merchantId,
        memberId: "member-demo",
        title: definition.title,
        kind: definition.kind,
        status: definition.kind === "DISCOUNT" ? "AVAILABLE" : "PENDING_FULFILLMENT",
        issuedAt: today,
      };
      memberVouchers.unshift(voucher);
      return { voucher: clone(voucher), wallet: clone(wallet) };
    },
    async listRewardFulfillments(merchantId) {
      await pause();
      return clone(memberVouchers.filter((v) => v.merchantId === merchantId && v.kind === "REWARD"));
    },
    async fulfillReward(id, merchantId) {
      await pause();
      if (!(await this.canManageMerchant(merchantId))) throw new Error("Cửa hàng chưa được duyệt");
      const voucher = memberVouchers.find(
        (v) => v.id === id && v.merchantId === merchantId && v.kind === "REWARD",
      );
      if (!voucher) throw new Error("Không tìm thấy phần thưởng");
      if (voucher.status !== "PENDING_FULFILLMENT") throw new Error("Phần thưởng đã xử lý");
      voucher.status = "FULFILLED";
      return clone(voucher);
    },
  };
}
