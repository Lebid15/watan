Metadata feature added (2025-09-05):

qty_values shapes:
- null | fixed => null
- range => { "min": <int>, "max": <int> }
- list => ["10","20",...]

params array now lists param keys (required & optional) based on params_schema.

Validation codes:
106 Quantity not allowed (wrong for mode null/fixed/list)
112 Quantity too small (range below min)
113 Quantity too large (range above max)
114 Missing/Invalid param