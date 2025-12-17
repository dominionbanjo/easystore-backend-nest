-- =====================================================
-- 🎨 PRODUCT COLORS SEED (NO DUPLICATES)
-- Safe to re-run
-- =====================================================

INSERT INTO product_colors (id, name, hex, created_at, updated_at)
VALUES
-- Neutrals
(gen_random_uuid(), 'Black', '#000000', NOW(), NOW()),
(gen_random_uuid(), 'White', '#FFFFFF', NOW(), NOW()),
(gen_random_uuid(), 'Gray', '#808080', NOW(), NOW()),
(gen_random_uuid(), 'Light Gray', '#D3D3D3', NOW(), NOW()),
(gen_random_uuid(), 'Dark Gray', '#4F4F4F', NOW(), NOW()),
(gen_random_uuid(), 'Charcoal', '#36454F', NOW(), NOW()),
(gen_random_uuid(), 'Silver', '#C0C0C0', NOW(), NOW()),
(gen_random_uuid(), 'Ivory', '#FFFFF0', NOW(), NOW()),
(gen_random_uuid(), 'Cream', '#FFFDD0', NOW(), NOW()),
(gen_random_uuid(), 'Beige', '#F5F5DC', NOW(), NOW()),
(gen_random_uuid(), 'Taupe', '#483C32', NOW(), NOW()),

-- Reds & Pinks
(gen_random_uuid(), 'Red', '#FF0000', NOW(), NOW()),
(gen_random_uuid(), 'Dark Red', '#8B0000', NOW(), NOW()),
(gen_random_uuid(), 'Crimson', '#DC143C', NOW(), NOW()),
(gen_random_uuid(), 'Burgundy', '#800020', NOW(), NOW()),
(gen_random_uuid(), 'Maroon', '#800000', NOW(), NOW()),
(gen_random_uuid(), 'Pink', '#FFC0CB', NOW(), NOW()),
(gen_random_uuid(), 'Hot Pink', '#FF69B4', NOW(), NOW()),
(gen_random_uuid(), 'Rose', '#FF007F', NOW(), NOW()),
(gen_random_uuid(), 'Blush', '#DE5D83', NOW(), NOW()),

-- Oranges & Yellows
(gen_random_uuid(), 'Orange', '#FFA500', NOW(), NOW()),
(gen_random_uuid(), 'Dark Orange', '#FF8C00', NOW(), NOW()),
(gen_random_uuid(), 'Coral', '#FF7F50', NOW(), NOW()),
(gen_random_uuid(), 'Peach', '#FFE5B4', NOW(), NOW()),
(gen_random_uuid(), 'Apricot', '#FBCEB1', NOW(), NOW()),
(gen_random_uuid(), 'Yellow', '#FFFF00', NOW(), NOW()),
(gen_random_uuid(), 'Golden Yellow', '#E6BE00', NOW(), NOW()),
(gen_random_uuid(), 'Mustard', '#FFDB58', NOW(), NOW()),
(gen_random_uuid(), 'Amber', '#FFBF00', NOW(), NOW()),

-- Greens
(gen_random_uuid(), 'Green', '#008000', NOW(), NOW()),
(gen_random_uuid(), 'Dark Green', '#006400', NOW(), NOW()),
(gen_random_uuid(), 'Forest Green', '#228B22', NOW(), NOW()),
(gen_random_uuid(), 'Olive', '#808000', NOW(), NOW()),
(gen_random_uuid(), 'Mint', '#98FF98', NOW(), NOW()),
(gen_random_uuid(), 'Sage', '#9DC183', NOW(), NOW()),
(gen_random_uuid(), 'Emerald', '#50C878', NOW(), NOW()),
(gen_random_uuid(), 'Lime', '#32CD32', NOW(), NOW()),

-- Blues
(gen_random_uuid(), 'Blue', '#0000FF', NOW(), NOW()),
(gen_random_uuid(), 'Light Blue', '#ADD8E6', NOW(), NOW()),
(gen_random_uuid(), 'Sky Blue', '#87CEEB', NOW(), NOW()),
(gen_random_uuid(), 'Steel Blue', '#4682B4', NOW(), NOW()),
(gen_random_uuid(), 'Navy Blue', '#000080', NOW(), NOW()),
(gen_random_uuid(), 'Midnight Blue', '#191970', NOW(), NOW()),
(gen_random_uuid(), 'Teal', '#008080', NOW(), NOW()),
(gen_random_uuid(), 'Turquoise', '#40E0D0', NOW(), NOW()),

-- Purples
(gen_random_uuid(), 'Purple', '#800080', NOW(), NOW()),
(gen_random_uuid(), 'Violet', '#EE82EE', NOW(), NOW()),
(gen_random_uuid(), 'Lavender', '#E6E6FA', NOW(), NOW()),
(gen_random_uuid(), 'Plum', '#DDA0DD', NOW(), NOW()),
(gen_random_uuid(), 'Indigo', '#4B0082', NOW(), NOW()),

-- Browns
(gen_random_uuid(), 'Brown', '#8B4513', NOW(), NOW()),
(gen_random_uuid(), 'Chocolate', '#7B3F00', NOW(), NOW()),
(gen_random_uuid(), 'Coffee', '#6F4E37', NOW(), NOW()),
(gen_random_uuid(), 'Tan', '#D2B48C', NOW(), NOW()),
(gen_random_uuid(), 'Mocha', '#3B2F2F', NOW(), NOW())

ON CONFLICT DO NOTHING;
