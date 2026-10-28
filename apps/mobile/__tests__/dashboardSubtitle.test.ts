import { buildDashboardSubtitle } from '../src/lib/dashboardSubtitle';

test('bỏ đơn vị khi trùng xã đang làm việc', () => {
  expect(
    buildDashboardSubtitle({
      position: 'Chuyên viên',
      unit: 'Xã Tân Thạnh',
      wardName: 'Tân Thạnh',
      provinceName: 'Tỉnh Tây Ninh',
    }),
  ).toBe('Chuyên viên · Xã Tân Thạnh, Tỉnh Tây Ninh');
});

test('giữ đơn vị khi khác xã đang làm việc', () => {
  expect(
    buildDashboardSubtitle({
      position: 'Chuyên viên',
      unit: 'Sở Xây dựng Tây Ninh',
      wardName: 'Tân Thạnh',
      provinceName: 'Tỉnh Tây Ninh',
    }),
  ).toBe('Chuyên viên — Sở Xây dựng Tây Ninh · Xã Tân Thạnh, Tỉnh Tây Ninh');
});

test('chưa có đơn vị thì chỉ hiện chức vụ và xã', () => {
  expect(
    buildDashboardSubtitle({
      position: 'Chuyên viên',
      wardName: 'Tân Thạnh',
      provinceName: 'Tỉnh Tây Ninh',
    }),
  ).toBe('Chuyên viên · Xã Tân Thạnh, Tỉnh Tây Ninh');
});
