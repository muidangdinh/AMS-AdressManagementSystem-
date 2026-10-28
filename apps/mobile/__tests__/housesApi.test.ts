import type { HouseSummary, PaginatedResult } from '@tayninh/shared';
import { apiFetch } from '../src/lib/api';
import { findHouseByQrCode } from '../src/lib/housesApi';

jest.mock('../src/lib/api', () => ({ apiFetch: jest.fn() }));

const mockApiFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

function house(id: string, qrCode: string): HouseSummary {
  return { id, qrCode } as HouseSummary;
}

function result(items: HouseSummary[]): PaginatedResult<HouseSummary> {
  return { items, total: items.length, page: 1, pageSize: 10 };
}

beforeEach(() => {
  mockApiFetch.mockReset();
});

test('khớp chính xác qrCode, không phân biệt hoa thường', async () => {
  mockApiFetch.mockResolvedValue(
    result([house('1', 'TN-AAAAAAAA'), house('2', 'TN-ABCD1234')]),
  );

  await expect(findHouseByQrCode(' tn-abcd1234 ')).resolves.toMatchObject({ id: '2' });
  expect(mockApiFetch).toHaveBeenCalledWith('/api/houses?search=tn-abcd1234&pageSize=10');
});

test('trả null khi không có hồ sơ khớp chính xác', async () => {
  mockApiFetch.mockResolvedValue(result([house('1', 'TN-AAAAAAAA')]));

  await expect(findHouseByQrCode('TN-ABCD1234')).resolves.toBeNull();
});

test('mã rỗng không gọi API', async () => {
  await expect(findHouseByQrCode('   ')).resolves.toBeNull();
  expect(mockApiFetch).not.toHaveBeenCalled();
});
