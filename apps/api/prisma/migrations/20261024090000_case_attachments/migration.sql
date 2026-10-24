-- Tệp đính kèm hồ sơ hành chính (giấy tờ công dân).
-- Tệp lưu ngoài vùng tĩnh /uploads; chỉ tải qua endpoint có JWT.

-- CreateTable
CREATE TABLE "house_case_attachment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "house_case_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "house_case_attachment_storedName_key" ON "house_case_attachment"("storedName");

-- CreateIndex
CREATE INDEX "house_case_attachment_caseId_idx" ON "house_case_attachment"("caseId");

-- AddForeignKey
ALTER TABLE "house_case_attachment" ADD CONSTRAINT "house_case_attachment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "house_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_case_attachment" ADD CONSTRAINT "house_case_attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
