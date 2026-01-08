-- Check remaining free Gemini API calls for a given API key today
-- Replace 'YOUR_API_KEY_HERE' with actual API key

WITH api_key_user AS (
  SELECT ak."userId", ak.name as api_key_name, u.email
  FROM "ApiKey" ak
  JOIN "User" u ON ak."userId" = u.id
  WHERE ak.key = 'YOUR_API_KEY_HERE'
    AND ak."deletedAt" IS NULL
    AND ak."isActive" = true
)
SELECT 
  au.email,
  au.api_key_name,
  COALESCE(COUNT(al.id), 0) as calls_today,
  20 as daily_limit,
  GREATEST(0, 20 - COALESCE(COUNT(al.id), 0)) as remaining,
  CASE 
    WHEN COALESCE(COUNT(al.id), 0) >= 20 THEN true
    ELSE false
  END as exceeded
FROM api_key_user au
LEFT JOIN "AuditLog" al ON 
  al."userId" = au."userId"
  AND al."deletedAt" IS NULL
  AND al."path" NOT LIKE '%applied-jobs%'
  AND al."path" LIKE '/api/%'
  AND al."createdAt" >= DATE_TRUNC('day', NOW())
  AND al."createdAt" < DATE_TRUNC('day', NOW()) + INTERVAL '1 day'
GROUP BY au.email, au.api_key_name;

