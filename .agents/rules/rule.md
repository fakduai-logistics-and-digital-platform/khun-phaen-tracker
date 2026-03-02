---
trigger: always_on
---

backend ให้ทำกฏตามดังนี้
- วางแผนลง TODO_<id_task>.md ให้ถี่ถ้วนถามตัวเองซ้ำๆจนกว่าเจอทางที่ดี
- ไล่ทำตาม check list อันไหนเสร็จมา check list ด้วย
- เขียน unittest ด้วยหล่ะเพื่อเช็ต logic function ใดๆ
- ลบ TODO_<id_task>.md
- อย่าลืมหยุด server backend ให้ด้วยเดี๋ยวรันเอง
- backend ถ้ามีการสร้าง collection ใหม่ หรือ models ใหม่ หรือจะทำอะไรเกี่ยวกับ id ให้ใช้เป็น uuid เท่านั้น
- อะไรที่เกี่ยว id ให้ใช้ uuid เท่านั้นนะจะได้ง่าย
- clean code ไฟล์แต่ละไฟล์โค้ดไม่ควรเกิน 500 line
- ใช้คำสั่ง cargo check ตรวจสอบ error ทุกครั้งที่ implement และแก้จนกว่าจะไม่มี error


frontend
- วางแผนลง TODO_<id_task>.md ให้ถี่ถ้วนถามตัวเองซ้ำๆจนกว่าเจอทางที่ดี
- ไล่ทำตาม check list อันไหนเสร็จมา check list ด้วย
- เขียน unittest ด้วยหล่ะเพื่อเช็ต logic function ใดๆ
- check i18n ด้วยนะให้ครบทุกเคส
- ลบ TODO_<id_task>.md
- clean code แต่ละไฟล์ให้เบาที่สุด อะไรที่แยกเป็น component ได้ ไฟล์แต่ละไฟล์โค้ดไม่ควรเกิน 500 line
- ในการทำ UI ให้ใช้ design token ตามธีมที่ทำไว้ด้วยหล่ะ
- ใช้คำสั่ง npm run check ตรวจสอบ error ทุกครั้งที่ implement และแก้จนกว่าจะไม่มี error