-- إضافة المستخدم nur إلى جدول users القديم
INSERT INTO users (
    id, 
    username, 
    email, 
    password, 
    "tenantId", 
    "createdAt", 
    "updatedAt"
) VALUES (
    gen_random_uuid(), 
    'nur', 
    'nur@gmail.com', 
    '$2b$10$abcdefghijklmnopqrstuv', -- password hash مؤقت
    'fd0a6cce-f6e7-4c67-aa6c-a19fcac96536', -- shamtech tenant_id
    NOW(), 
    NOW()
);
