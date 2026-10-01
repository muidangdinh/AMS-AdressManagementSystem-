### MASTER TASK: Redesign Complete Web Application UI/UX for "TÂY NINH GIS" (Tech & Geospatial Theme)

I want you to overhaul the entire UI/UX of my web application "TÂY NINH GIS" across all current pages/modules. The application is a Spatial/Cadastral GIS system for house numbering, surveying, and administrative address management.
1. GLOBAL DESIGN SYSTEM & THEME
Design Philosophy: Cyber-Tech / Modern Geospatial Platform (similar to Mapbox, ESRI ArcGIS, or Datadog style).

Color Palette:

Background (Main App Area): Dark Slate / Deep Navy (#0F172A or #182232) with clean dark cards (#1E293B).

Sidebar & Top Header: #0B1120 with subtle border divider (border-slate-800).

Status Badges & Accents:

Active / Approved / Đã cấp biển & QR: Cyber Cyan / Emerald (#10B981 / #06B6D4) with light glow.

Pending / Chờ duyệt / Đang triển khai: Warm Amber (#F59E0B).

Warning / Cần hiệu chỉnh: Crimson Red (#EF4444).

Proposal / Đề xuất: Electric Violet / Blue (#6366F1).

Card Styling: Glassmorphism (backdrop-blur-md, bg-slate-900/60, border border-slate-800/80, rounded-xl, shadow-lg).

Typography & Icons: Font Inter or Roboto, paired with Lucide React icons (MapPin, Layers, Globe, Database, UserCheck, FileText, Route, CheckCircle2).

2. PAGE-BY-PAGE REDESIGN REQUIREMENTS
A. Sidebar & Top Navigation (Global Layout)
Sidebar:

Modern vertical nav with glowing accent indicators on active items.

Group icons logically with subtle tech icons next to menu text.

Top Header:

Show quick live KPI counters in the center-top status bar (Tổng số nhà, Đã cấp biển/QR, Chờ duyệt, Cần hiệu chỉnh) styled with glowing status dots.

Add Dark/Light mode toggle, Notification Bell with glowing badge, and User Avatar block.

B. Module 1: "Hồ sơ nhà" (House Records & Map View)
Controls & Filters Bar:

Glass-card container for Search input (with shortcut key indicator Ctrl+K), Dropdowns for Ấp/Thôn, Đường, Trạng thái.

View Switcher Toggle: Styled Segmented Control ([ 📋 Bảng ] vs [ 🗺️ Bản đồ ]).

Action Buttons: Cyber Green button for [⚡ Xuất Excel] and Electric Blue gradient for [+ Thêm số nhà].

Table View:

Dark-mode responsive table with subtle hover row highlighting (hover:bg-slate-800/50).

Styled tags/badges for Trạng thái and Loại nhà.

Map View:

Dark-theme vector map integration (Mapbox Dark / Leaflet CartoDB Dark Matter).

Floating Left Sidebar for house list over the map with smooth glassmorphism effect and search filter.

Custom SVG map markers matching status colors.

C. Module 2: "Khảo sát" & "Chi tiết đợt khảo sát" (Survey Management & Live Route Tracking)
Survey List:

Replace flat table with sleek Status Cards for survey rounds (Đợt khảo sát), showing progress bar, assigned area, creator, and status badges (Đang triển khai, Nháp).

Survey Detail View:

Full-width GIS Map view displaying interactive survey routes (Polylines in glowing green/blue).

Top bar with route stats (Chiều dài tuyến, Số nhà khảo sát, Phân vùng).

Bottom worker assignment panel with progress bar indicator for surveyors (Cán bộ khảo sát).

D. Module 3: "Hồ sơ" & "Đánh số" (Workflow & House Numbering Plans)
Process / Workflow Page:

Empty state redesign: Tech-themed SVG placeholder when Chưa có hồ sơ nào instead of plain icon.

Filter bar with quick status chips (Tất cả, Đang xử lý, Đã hoàn thành).

Numbering Plan Page ("Lập phương án đánh số"):

Card-based view or clean table displaying numbering proposals per street segment with quick action buttons ([+ Tạo phương án mới], [Trình duyệt]).

E. Module 4: "Quản lý tuyến đường" & "Danh mục địa chỉ" (Address Directory Management)
Tab Navigation: Segmented tabs for Quận/Huyện, Xã/Phường, Thôn/Ấp/Tổ dân phố, Đường/Phố, Hẻm/Ngõ.

Interactive Form & List: Clean inline creation form with cyber-styled input focus state and animated table rows.

F. Module 5: "Người dùng" & "Vai trò & phân quyền" (User Management & RBAC)
User List:

User avatar with online/active indicator.

Role tags with custom color coding (Admin = Crimson/Violet, Cadastral Officer = Cyan, Surveyor = Emerald).

Role & Permission Management:

Permission matrix with styled toggle switches (Checkbox -> Cyber Toggle Switches).

3. TECHNICAL SPECIFICATIONS
Framework/CSS: [Insert your stack here: e.g., React + Tailwind CSS / Vue 3 + Tailwind / Blade + Bootstrap 5]

Theme Standard: Responsive, CSS Variables for easy color adjustments, smooth transition animations (transition-all duration-300).

Code Output: Generate fully responsive, modular, and reusable frontend components for all pages listed above.