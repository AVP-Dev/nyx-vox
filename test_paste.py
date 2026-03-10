import time
from Quartz import CGEventCreateKeyboardEvent, CGEventPost, kCGHIDEventTap, CGEventSetFlags, kCGEventFlagMaskCommand

time.sleep(1)

def p(down):
    e = CGEventCreateKeyboardEvent(None, 9, down)
    CGEventSetFlags(e, kCGEventFlagMaskCommand)
    CGEventPost(kCGHIDEventTap, e)

p(True)
time.sleep(0.05)
p(False)
