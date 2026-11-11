import { articles, home, navigation, services } from "./content";

const serviceCopy = [
  [
    "Rửa xe chuyên sâu",
    "Làm sạch ngoại thất kỹ lưỡng, trả lại vẻ sáng bóng cho xe.",
  ],
  ["Vệ sinh nội thất", "Làm sạch sâu ghế, thảm và các bề mặt bên trong xe."],
  ["Hiệu chỉnh sơn", "Giảm xước nhẹ, vết xoáy và phục hồi độ bóng của sơn."],
  [
    "Phủ ceramic",
    "Bảo vệ bề mặt, tăng độ bóng và giúp việc chăm sóc xe dễ dàng hơn.",
  ],
  [
    "Dán phim PPF",
    "Bảo vệ sơn trước đá văng, trầy xước và tác động từ môi trường.",
  ],
  [
    "Dán phim cách nhiệt",
    "Giảm chói, tăng riêng tư và mang lại không gian lái dễ chịu.",
  ],
  [
    "Vệ sinh khoang máy",
    "Làm sạch khoang động cơ cẩn thận, gọn gàng và chuyên nghiệp.",
  ],
  ["Phục hồi đèn pha", "Xử lý ố vàng, mờ đục và lấy lại độ trong cho đèn pha."],
  ["Tẩy ố kính", "Loại bỏ cặn khoáng và vết ố cứng đầu trên kính xe."],
  ["Phủ gầm bảo vệ", "Bảo vệ gầm xe trước độ ẩm, đất đá và hao mòn hằng ngày."],
];

export const homeServices = services.map((service, i) => ({
  ...service,
  title: serviceCopy[i][0],
  description: serviceCopy[i][1],
  image: { ...service.image, alt: serviceCopy[i][0] },
}));

export const homeNavigation = navigation.map((item, i) => ({
  ...item,
  label: [
    "Dịch vụ",
    "Bảng giá",
    "Thành quả",
    "Tin tức",
    "Giới thiệu",
    "Thương hiệu",
  ][i],
}));

const articleCopy = [
  [
    "Chăm sóc xe sau khi phủ ceramic",
    "Cách rửa và chăm sóc xe để giữ lớp phủ ceramic bền đẹp.",
    "22/09/2026",
  ],
  [
    "PPF và ceramic khác nhau thế nào?",
    "Tìm hiểu sự khác biệt để chọn cách bảo vệ phù hợp cho xe.",
    "16/09/2026",
  ],
  [
    "Lưu ý sau khi dán phim cách nhiệt",
    "Những điều cần biết để phim ổn định và giữ được độ bền.",
    "09/09/2026",
  ],
  [
    "Chăm sóc xe trong mùa mưa Seattle",
    "Hạn chế ảnh hưởng của độ ẩm và nước mưa lên bề mặt xe.",
    "02/09/2026",
  ],
  [
    "Vì sao cần chuẩn bị kỹ trước khi chăm sóc xe?",
    "Khám phá bước chuẩn bị giúp quá trình chăm sóc xe đạt hiệu quả.",
    "24/08/2026",
  ],
  [
    "Ưu đãi bảo vệ xe theo mùa",
    "Chăm sóc và bảo vệ xe với chương trình ưu đãi theo mùa.",
    "15/08/2026",
  ],
];

export const homeArticles = articles.map((article, i) => ({
  ...article,
  title: articleCopy[i][0],
  description: articleCopy[i][1],
  date: articleCopy[i][2],
  category:
    article.category === "CAR CARE"
      ? "CHĂM SÓC XE"
      : article.category === "NEWS"
        ? "TIN TỨC"
        : "ƯU ĐÃI",
  image: { ...article.image, alt: articleCopy[i][0] },
}));

export const homeVi = {
  process: [
    {
      title: "Chọn dịch vụ",
      description: "Chọn dịch vụ phù hợp với nhu cầu và tình trạng xe của bạn.",
    },
    {
      title: "Liên hệ hoặc ghé gara",
      description:
        "Gọi trước để được tư vấn dịch vụ và sắp xếp thời gian đưa xe đến.",
    },
    {
      title: "Kiểm tra và báo giá",
      description:
        "Chúng tôi kiểm tra xe, tư vấn hạng mục, báo chi phí và thời gian hoàn thành.",
    },
    {
      title: "Nhận xe và kiểm tra",
      description:
        "Khi hoàn tất, chúng tôi sẽ liên hệ để bạn đến nhận xe, kiểm tra kết quả và thanh toán.",
    },
  ],
  benefits: [
    {
      title: "Kỹ thuật viên giàu kinh nghiệm",
      description: "Am hiểu nhiều dòng xe và quy trình chăm sóc chuyên sâu.",
    },
    {
      title: "Thiết bị chuyên nghiệp",
      description: "Trang bị đầy đủ cho vệ sinh, hiệu chỉnh và bảo vệ xe.",
    },
    {
      title: "Sản phẩm chất lượng",
      description: "Lựa chọn kỹ lưỡng, phù hợp với từng bề mặt và dịch vụ.",
    },
    {
      title: "Tư vấn rõ ràng",
      description: "Kiểm tra tình trạng xe trước khi đề xuất dịch vụ phù hợp.",
    },
    {
      title: "Cam kết hài lòng",
      description: "Tận tâm với từng công việc và trải nghiệm của bạn.",
    },
    {
      title: "Lịch hẹn linh hoạt",
      description: "Sắp xếp thời gian chăm sóc xe phù hợp với bạn.",
    },
  ],
  training: [
    {
      title: "Học cùng chuyên gia",
      description:
        "Được hướng dẫn trực tiếp bởi đội ngũ giàu kinh nghiệm thực tế.",
    },
    {
      title: "Thực hành có hướng dẫn",
      description: "Thực hành trên xe thật, được hướng dẫn kỹ từng bước.",
    },
    {
      title: "Có sẵn dụng cụ học tập",
      description:
        "Được sử dụng đầy đủ thiết bị chuyên nghiệp trong suốt khóa học.",
    },
    {
      title: "Trải nghiệm tại xưởng",
      description:
        "Làm quen với quy trình, yêu cầu khách hàng và tiêu chuẩn thực tế.",
    },
    {
      title: "Cơ hội phát triển nghề",
      description:
        "Học viên có tay nghề và tinh thần tốt có cơ hội làm việc tại HyperAuto Care.",
    },
  ],
  reviews: home.reviews.map((review, i) => ({
    ...review,
    text: [
      "Phim PPF dán rất gọn, gần như không thấy mép. Đội ngũ còn tư vấn rõ những vị trí nên ưu tiên bảo vệ.",
      "Xe tôi có nhiều vết xước và xoáy sơn. Sau khi hiệu chỉnh, bề mặt mịn và bóng sâu hơn hẳn. Rất hài lòng!",
      "Tôi ghé rửa xe và hỏi thêm về đèn pha bị mờ. Sau khi phục hồi, đèn trong hơn thấy rõ.",
      "Sơn xe đẹp hơn hẳn sau khi hiệu chỉnh và phủ ceramic. Quy trình được giải thích rõ ràng, dễ hiểu.",
      "Sau chuyến đi dài, tôi mang SUV đến vệ sinh nội thất. Khi nhận xe, ghế, thảm và táp-lô đều sạch hơn nhiều.",
      "Phim cách nhiệt dán đẹp, gọn gàng. Được tư vấn rõ từng lựa chọn, xe mát và dễ chịu hơn.",
      "Sơn xe bị xoáy và xuống bóng khá nhiều. HyperAuto Care phục hồi rất tốt, kết quả vượt mong đợi của tôi.",
    ][i],
    service: [
      "Dán phim PPF · BMW 3 Series",
      "Hiệu chỉnh sơn · Ford F-150",
      "Rửa xe & phục hồi đèn · Honda Accord",
      "Phủ ceramic · Tesla Model 3",
      "Vệ sinh nội thất · Toyota Highlander",
      "Dán phim cách nhiệt · Ford Mustang",
      "Hiệu chỉnh sơn · Porsche Macan",
    ][i],
  })),
  faq: [
    {
      question: "Có cần đặt lịch trước không?",
      answer:
        "Một số dịch vụ có thể tiếp nhận trực tiếp. Với phủ ceramic, hiệu chỉnh sơn, dán PPF và phim cách nhiệt, bạn nên gọi trước.",
    },
    {
      question: "Có thể mang xe đến ngay không?",
      answer:
        "Có. Khả năng tiếp nhận tùy vào dịch vụ và lượng xe tại gara trong ngày.",
    },
    {
      question: "Chăm sóc xe mất bao lâu?",
      answer:
        "Thời gian tùy vào dịch vụ, kích thước và tình trạng thực tế của xe.",
    },
    {
      question: "Lớp phủ ceramic bền bao lâu?",
      answer:
        "Độ bền tùy vào loại phủ, cách sử dụng xe, chế độ chăm sóc và môi trường.",
    },
    {
      question: "Giá có thay đổi theo kích thước xe không?",
      answer: "Có. Xe lớn hoặc cần vệ sinh, xử lý thêm có thể có mức giá khác.",
    },
    {
      question: "Dịch vụ nào nên đặt lịch trước?",
      answer:
        "Bạn nên đặt trước khi hiệu chỉnh sơn, phủ ceramic, dán PPF, dán phim cách nhiệt hoặc chăm sóc xe chuyên sâu.",
    },
    {
      question: "Gara có nhận xe cũ không?",
      answer:
        "Có. Chúng tôi sẽ kiểm tra và tư vấn cách vệ sinh, phục hồi hoặc bảo vệ phù hợp.",
    },
    {
      question: "Có thể nhận xe trong ngày không?",
      answer:
        "Một số dịch vụ hoàn thành trong ngày. Các hạng mục chuyên sâu hoặc bảo vệ xe có thể cần thêm thời gian.",
    },
  ],
};
