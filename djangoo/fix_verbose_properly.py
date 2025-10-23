"""
Fix verbose logging - properly wrap all prints with verbose check
"""
import re

# Read file
with open('apps/orders/tasks.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the check_order_status function
func_start = content.find('def check_order_status(self,')
if func_start == -1:
    print("❌ Could not find check_order_status function!")
    exit(1)

# Find the next function after check_order_status
next_func = content.find('\ndef ', func_start + 10)
if next_func == -1:
    next_func = len(content)

# Extract the function
before = content[:func_start]
func_content = content[func_start:next_func]
after = content[next_func:]

# Count current verbose checks and prints
verbose_count = func_content.count('if verbose:')
print_count = func_content.count('print(')

print(f"📊 Current state:")
print(f"   - 'if verbose:' checks: {verbose_count}")
print(f"   - 'print(' statements: {print_count}")

# Now let's reduce verbosity more aggressively
# Replace the verbose flag to only print every 10th attempt instead of 5th
func_content = func_content.replace(
    'verbose = (attempt == 1 or attempt % 5 == 0)',
    'verbose = (attempt == 1 or attempt % 10 == 0)'
)

# Remove all Arabic emoji prints for retry info (these are always printed)
# Keep only the essential INFO level logs
lines = func_content.split('\n')
new_lines = []
skip_next = False

for i, line in enumerate(lines):
    # Skip Arabic warning messages that are always printed
    if any(x in line for x in ['WARNING/MainProcess', '📡 استعلام', '📥 استجابة', '📊 Current', 
                                 '🗺️ Status', '🔄 معالجة', '⚙️ تطبيق', '🔄 تحديث',
                                 '⚠️ External', '🔑 استلام', '💬 تحديث', '💾 Database',
                                 '💾 تم تحديث', '🔗 تفعيل', '⏳ الطلب', '❌ خطأ',
                                 '✨ تغيير', '⏸️  لا تغيير', '⏸️  لا توجد']):
        # Check if this line has 'if verbose:' before it
        if i > 0 and 'if verbose:' not in lines[i-1]:
            # Add verbose check
            indent = len(line) - len(line.lstrip())
            new_lines.append(' ' * indent + 'if verbose:\n')
            new_lines.append(' ' * (indent + 4) + line.lstrip() + '\n')
            continue
    
    new_lines.append(line + '\n')

func_content = ''.join(new_lines).rstrip('\n')

# Write back
with open('apps/orders/tasks.py', 'w', encoding='utf-8') as f:
    f.write(before + func_content + after)

print("✅ Updated verbose logging - now prints only on attempt 1, 10, 20, 30...")
