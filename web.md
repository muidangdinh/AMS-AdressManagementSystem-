Bạn là một Expert Frontend Developer & UI/UX Designer. Hãy tạo một file Landing Page HTML/CSS hoàn chỉnh, production-ready. Yêu cầu thiết kế được chia làm 2 phần: Content Structure và Style Guide.

### PHẦN 1: CẤU TRÚC NỘI DUNG (Content Structure)
Hãy tạo trang web cho một sản phẩm API AI (ví dụ: ContextAI) với các section sau theo đúng thứ tự. Bạn có thể tự điền nội dung placeholder văn bản (text), nhưng phải giữ cấu trúc:

*Lưu ý: Background body có pattern lưới chấm bi. Chèn thêm 3 thẻ div (khối cầu phát sáng mờ/orbs) dùng làm background animation.*

**1. Navbar**
- Top cố định, có hiệu ứng kính mờ (backdrop-filter blur). Viền dưới siêu mỏng.
- Trái: Logo Icon SVG + Text "ContextAI" (font Space Grotesk).
- Giữa: Các links (Product, API, Pricing, Docs).
- Phải: Nút CTA "Get API Key" (viền sáng glow).

**2. Hero Section**
- Căn giữa toàn bộ.
- Trên cùng là một Label/Badge dạng pill "Now in Public Beta ✦" có viền gradient cực đẹp.
- H1 "The AI that actually understands context."
- Text mô tả mỏng. 2 nút CTA (1 nút Glow, 1 nút Ghost).
- Bên dưới là một khối chữ nhật mô phỏng Terminal (Hero Code), chứa lệnh `curl` gọi API (sử dụng font monospace).

**3. Demo Block Section (Live Try)**
- Căn giữa, giới hạn chiều rộng (max-width nhỏ lại). Nằm trong thẻ div có nền đen đen, viền xám sáng 0.1.
- Header: Text "Try it live", có kèm một dấu chấm xanh lá (Status dot: All systems operational).
- Nội dung là một khung Chat giả lập:
  - Tin nhắn của người dùng (nằm bên phải, nền xám nhạt).
  - Tin nhắn của AI (nằm bên trái, nền tím nhạt mờ, viền tím).
  - Khung input text ở dưới cùng + nút Send.

**4. Logos Section**
- Dải logo đối tác nằm ngang. Tiêu đề nhỏ "Used by developers at". Các logo xám/mờ (grayscale). Ví dụ: Slack, Microsoft, Linear, Vercel (dùng text + icon SVG đơn giản).

**5. Pricing / Models Grid**
- H2 căn giữa "Built for scale."
- Lưới 3 cột. 3 thẻ Card hiển thị 3 model AI khác nhau.
- Bên trong thẻ: Badge nhỏ ghi tên model (vd: Context-3-Mini) màu tím -> H3 -> Mô tả -> Dưới cùng là Giá (dùng font monospace).
- Thẻ ở giữa (Context-4-Omni) nổi bật hơn bằng cách dùng viền gradient phát sáng (animated-border) và hover effect mạnh hơn.

**6. Code Editor / Integration Section**
- Lưới 2 cột (1 cột text, 1 cột hình/mockup).
- Cột Text: H2 "From zero to production in 5 minutes.", mô tả, nút "Read Documentation".
- Cột Mockup: Tạo một cửa sổ Code Editor giả lập (có 3 dấu chấm đỏ-vàng-xanh giống MacOS trên góc trái). Bên dưới là code Javascript import SDK của AI (dùng font JetBrains Mono, tô màu syntax cho từ khóa).

**7. Features Section**
- H2 căn giữa "Powerful features out of the box."
- Lưới 3 cột x 2 hàng (6 thẻ features).
- Thẻ có box-shadow dạng `inset` nhẹ (ánh sáng tím hắt từ dưới lên).
- Bên trong: H3 -> Mô tả ngắn gọn (JSON Mode, Function Calling, Streaming, 200K Context...).

**8. Footer**
- Viền trên mỏng.
- Lưới 4 cột:
  - Cột 1: Logo, Mô tả ngắn, Status indicator (dấu chấm xanh lá).
  - Cột 2, 3, 4: Danh sách links (Product, Developers, Company).

### PHẦN 2: DESIGN STYLE & SYSTEM (Bắt buộc tuân thủ 100%)
**Style: AI-Native UI**
- Background: near-black (#09090B) with subtle dot-grid pattern (rgba(255,255,255,0.04)).
- Primary: AI Purple (#6366F1), Indigo (#4338CA). Success: Emerald (#10B981).
- Text: Light (#F4F4F5), Muted (#A1A1AA). Surface: rgba(255, 255, 255, 0.03).
- Font: Space Grotesk (headings) + Inter (body) + JetBrains Mono (code) — Google Fonts.
- Decorative: Use large blurred orbs (radial-gradient, purple/indigo/cyan, filter blur 80px) behind the content with slow floating animations.
- CTA Button: Use a glowing border effect (`box-shadow: 0 0 20px rgba(99,102,241,0.5)`).
- Hover: Glow intensifies on cards, subtle scale(1.02), border transitions.

**Design quality rules (required — do not skip):**

1. SPACING (8px grid — strict, no exceptions):
   - Priority: ALWAYS use 'padding' and 'gap' (Flexbox/Grid) for spacing. Avoid 'margin' as much as possible to prevent layout breaking or collapsing margins.
   - Section padding: 96px top/bottom desktop, 64px mobile — NEVER less.
   - Gap between sections: 96px minimum.
   - Card padding: 24-32px inside. Gap between cards: 24px. Cards must NEVER touch each other.
   - Child elements inside cards: gap ≥ 16px between every element, flex/grid gap ≥ 16px.
   - Container: max-width 1280px, horizontal padding 24px mobile / 48px desktop. Use padding on inner container, NEVER apply padding directly to <section> tags.
   - Alignment: Use absolute px for precise centering/positioning to prevent flex height drift. Add more space if elements look crowded on 375px screens.

2. TYPOGRAPHY & FONTS:
   - Language Support: MUST choose Google Fonts that fully support Vietnamese (e.g. Inter, Roboto, Plus Jakarta Sans, Be Vietnam Pro) to prevent broken diacritics.
   - Variables (define in :root):
     --fs-display: clamp(2.5rem, 6vw, 5rem) / weight 800 / letter-spacing -0.02em
     --fs-h1: clamp(1.75rem, 4vw, 3rem) / weight 700 / letter-spacing -0.02em
     --fs-h2: clamp(1.25rem, 2.5vw, 2rem) / weight 600
     --fs-h3: clamp(1rem, 2vw, 1.5rem) / weight 600
     --fs-body: 1rem / weight 400 / line-height 1.6
     --fs-small: 0.875rem / weight 500
   - Use Space Grotesk for Headings to give it a techy feel. Use JetBrains Mono for Code blocks and pricing numbers.

3. SHADOWS & RADIUS:
   - Use subtle glows instead of dark drop shadows (since background is already dark).
   - Border-radius: 8px for small buttons, 12px for small containers, 24px for large cards.

4. DESIGN & LAYOUT:
   - Background Pattern: Use `radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)` with `background-size: 24px 24px`.
   - Cards/Containers: Must have a subtle border (`1px solid rgba(255,255,255,0.05)`) and a very transparent surface background.

5. CODE QUALITY & ACCESSIBILITY:
   - All colors as CSS variables.
   - Include cursor:pointer on clickable elements and hover states on interactive elements.
   - Use inline SVG for icons.
   - Responsive: Mobile-first breakpoints (375px / 768px / 1024px / 1440px). No horizontal scroll.

6. CONSISTENCY & PROFESSIONALISM:
   - Component Harmony: Ensure all borders are exactly 1px thick unless specifically designed as a thick divider.
   - Code Cleanliness: Use semantic HTML5. Keep CSS well-organized. No inline styles.

7. RESPONSIVE LAYOUT & OVERFLOW:
   - Mobile First: NEVER force multi-column grids (like 12-columns) on mobile. ALWAYS stack items to 1 column on mobile screens. Use media queries to activate multi-column layouts on desktop.
   - Flexible Cards: Cards must NOT have fixed heights that clip content. Use min-height and allow vertical expansion.
   - Overflow Prevention: Use 'word-break: break-word' to prevent wide text or links from breaking out of cards. Ensure child elements do not force the parent to grow beyond the viewport width.

*Quy tắc xuất output*: Viết duy nhất 1 file HTML bao gồm CSS. Code đẹp, có comment rõ ràng phân chia từng section.