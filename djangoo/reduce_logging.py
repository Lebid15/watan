"""
Script to reduce verbose logging in tasks.py
This will wrap all print statements with 'if verbose:' checks
"""
import re

# Read the file
with open('apps/orders/tasks.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Track if we're inside check_order_status function
inside_function = False
function_indent = 0
modified = []

for i, line in enumerate(lines):
    # Detect start of check_order_status function
    if 'def check_order_status(self,' in line:
        inside_function = True
        function_indent = len(line) - len(line.lstrip())
        modified.append(line)
        continue
    
    # Detect end of function (next function at same or lower indent level)
    if inside_function and line.strip().startswith('def ') and (len(line) - len(line.lstrip())) <= function_indent:
        inside_function = False
    
    # If inside function and line is a print statement
    if inside_function and line.strip().startswith('print('):
        indent = len(line) - len(line.lstrip())
        # Check if already wrapped with if verbose:
        prev_line = modified[-1] if modified else ''
        if 'if verbose:' not in prev_line:
            # Add 'if verbose:' before the print
            modified.append(' ' * indent + 'if verbose:\n')
            # Increase indent for print
            modified.append(' ' * (indent + 4) + line.lstrip())
        else:
            modified.append(line)
    else:
        modified.append(line)

# Write back
with open('apps/orders/tasks.py', 'w', encoding='utf-8') as f:
    f.writelines(modified)

print("✅ Modified tasks.py - wrapped all print() with 'if verbose:' checks")
