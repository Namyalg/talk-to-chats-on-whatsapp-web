#!/usr/bin/env python3
"""
Generate an MP4 demo video with voice narration emphasizing privacy
"""

from PIL import Image, ImageDraw, ImageFont
import os
import subprocess
import math

# Constants
WIDTH = 1400
HEIGHT = 900
FPS = 30

# Colors
WA_GREEN = (7, 94, 84)
WA_LIGHT_GREEN = (37, 211, 102)
WA_BG = (240, 242, 245)
WHITE = (255, 255, 255)
GRAY = (84, 101, 111)
LIGHT_GRAY = (233, 237, 239)
TEXT_COLOR = (28, 30, 33)

def ease_out_cubic(t):
    """Smooth easing function"""
    return 1 - pow(1 - t, 3)

def create_base_frame():
    """Create base WhatsApp Web interface"""
    img = Image.new('RGB', (WIDTH, HEIGHT), WA_BG)
    draw = ImageDraw.Draw(img, 'RGBA')

    try:
        title_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 18)
        text_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 14)
        small_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 12)
    except:
        title_font = text_font = small_font = None

    # Top header
    draw.rectangle([0, 0, WIDTH, 70], fill=WA_GREEN)
    draw.text((25, 22), "WhatsApp", fill=WHITE, font=title_font)

    # Sidebar
    draw.rectangle([0, 70, 380, HEIGHT], fill=WHITE)
    draw.rounded_rectangle([10, 85, 370, 120], radius=8, fill=WA_BG)
    draw.text((20, 95), "Search or start new chat", fill=GRAY, font=small_font)

    # Chat list
    chat_y = 140
    contacts = [
        ("John Smith", "Great! See you then 👍", "14:32"),
        ("Work Team", "Meeting at 3pm", "13:15"),
        ("Mom", "Call me when you're free", "11:20"),
    ]

    for i, (name, preview, time) in enumerate(contacts):
        bg = (243, 247, 249) if i == 0 else WHITE
        draw.rectangle([0, chat_y, 380, chat_y + 75], fill=bg)
        draw.ellipse([15, chat_y + 10, 60, chat_y + 55], fill=WA_LIGHT_GREEN if i == 0 else LIGHT_GRAY)
        draw.text((75, chat_y + 15), name, fill=TEXT_COLOR, font=text_font)
        draw.text((75, chat_y + 38), preview, fill=GRAY, font=small_font)
        draw.text((300, chat_y + 15), time, fill=GRAY, font=small_font)
        draw.line([75, chat_y + 74, 380, chat_y + 74], fill=LIGHT_GRAY, width=1)
        chat_y += 75

    # Main chat area
    draw.rectangle([380, 70, WIDTH, HEIGHT], fill=(229, 221, 213))
    draw.rectangle([380, 70, WIDTH, 130], fill=WA_BG)
    draw.line([380, 130, WIDTH, 130], fill=LIGHT_GRAY, width=2)
    draw.ellipse([395, 85, 435, 125], fill=WA_LIGHT_GREEN)
    draw.text((450, 90), "John Smith", fill=TEXT_COLOR, font=title_font)
    draw.text((450, 112), "online", fill=GRAY, font=small_font)

    # Messages
    messages = [
        ("Hey! How are you?", 170, False),
        ("I'm good! How about you?", 230, True),
        ("Great! Did you see the game yesterday?", 290, False),
        ("Yes! It was amazing!", 350, True),
        ("The final goal was incredible", 410, False),
        ("I know right! Best match this season", 470, True),
        ("Should we grab coffee this weekend?", 530, False),
        ("Absolutely! Saturday works for me", 590, True),
    ]

    for text, y, is_me in messages:
        msg_width = min(len(text) * 8 + 30, 500)
        x = WIDTH - msg_width - 50 if is_me else 420
        color = (213, 249, 186) if is_me else WHITE

        draw.rounded_rectangle([x + 2, y + 2, x + msg_width + 2, y + 47],
                              radius=8, fill=(0, 0, 0, 20))
        draw.rounded_rectangle([x, y, x + msg_width, y + 45], radius=8, fill=color)
        draw.text((x + 15, y + 13), text, fill=TEXT_COLOR, font=text_font)

    return img

def create_frame_with_extension(base_img, animation_progress, show_loading, show_result):
    """Add extension popup"""
    img = base_img.copy()
    draw = ImageDraw.Draw(img, 'RGBA')

    try:
        title_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
        text_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 13)
        small_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 11)
    except:
        title_font = text_font = small_font = None

    popup_x = WIDTH - 420
    popup_y = 80
    popup_width = 400
    popup_height = 550

    eased_progress = ease_out_cubic(animation_progress)
    offset_x = int((1 - eased_progress) * popup_width)
    actual_x = popup_x + offset_x

    # Shadow
    shadow = Image.new('RGBA', (WIDTH, HEIGHT), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    for i in range(10):
        alpha = int(30 * (1 - i/10) * eased_progress)
        shadow_draw.rounded_rectangle(
            [actual_x + i, popup_y + i, actual_x + popup_width + i, popup_y + popup_height + i],
            radius=12, fill=(0, 0, 0, alpha)
        )
    img = Image.alpha_composite(img.convert('RGBA'), shadow).convert('RGB')
    draw = ImageDraw.Draw(img, 'RGBA')

    # Popup
    draw.rounded_rectangle([actual_x, popup_y, actual_x + popup_width, popup_y + popup_height],
                          radius=12, fill=WA_BG)
    draw.text((actual_x + 90, popup_y + 22), "WhatsApp Summarizer", fill=WA_GREEN, font=title_font)

    # Status
    status_y = popup_y + 60
    draw.ellipse([actual_x + 20, status_y, actual_x + 32, status_y + 12], fill=WA_LIGHT_GREEN)
    draw.text((actual_x + 42, status_y - 2), "Gemini Nano enabled", fill=GRAY, font=small_font)

    # Tabs
    tab_y = popup_y + 95
    draw.rounded_rectangle([actual_x + 20, tab_y, actual_x + popup_width - 20, tab_y + 45],
                          radius=8, fill=WHITE)
    draw.rounded_rectangle([actual_x + 25, tab_y + 5, actual_x + 195, tab_y + 40],
                          radius=6, fill=WA_GREEN)
    draw.text((actual_x + 85, tab_y + 16), "Summary", fill=WHITE, font=text_font)
    draw.text((actual_x + 270, tab_y + 16), "Ask", fill=GRAY, font=text_font)

    # Buttons
    btn_y = tab_y + 65
    draw.rounded_rectangle([actual_x + 20, btn_y, actual_x + 195, btn_y + 45],
                          radius=8, fill=WA_GREEN)
    draw.text((actual_x + 65, btn_y + 15), "tl;dr brief", fill=WHITE, font=text_font)
    draw.rounded_rectangle([actual_x + 205, btn_y, actual_x + 380, btn_y + 45],
                          radius=8, fill=WA_LIGHT_GREEN)
    draw.text((actual_x + 235, btn_y + 15), "tl;dr verbose", fill=WHITE, font=text_font)

    if show_loading:
        result_y = btn_y + 70
        draw.text((actual_x + 110, result_y + 10), "Generating summary...", fill=GRAY, font=text_font)

    if show_result > 0:
        result_y = btn_y + 70
        alpha = int(255 * show_result)
        draw.rounded_rectangle([actual_x + 20, result_y, actual_x + popup_width - 20, result_y + 250],
                              radius=8, fill=WHITE)
        draw.text((actual_x + 30, result_y + 15), "Summary", fill=GRAY, font=text_font)

        summary_lines = [
            "John asked about your wellbeing and",
            "discussed yesterday's game.",
            "",
            "You both agreed the final goal was incredible",
            "and it was the best match of the season.",
            "",
            "Plans were made to grab coffee this",
            "weekend on Saturday."
        ]

        text_y = result_y + 50
        for line in summary_lines:
            draw.text((actual_x + 30, text_y), line,
                     fill=(TEXT_COLOR[0], TEXT_COLOR[1], TEXT_COLOR[2], alpha), font=small_font)
            text_y += 22

        btn_y_action = result_y + 210
        draw.rounded_rectangle([actual_x + 30, btn_y_action, actual_x + 130, btn_y_action + 35],
                              radius=6, fill=LIGHT_GRAY)
        draw.text((actual_x + 60, btn_y_action + 10), "🔊 Read", fill=GRAY, font=small_font)
        draw.rounded_rectangle([actual_x + 145, btn_y_action, actual_x + 245, btn_y_action + 35],
                              radius=6, fill=LIGHT_GRAY)
        draw.text((actual_x + 170, btn_y_action + 10), "📋 Copy", fill=GRAY, font=small_font)

    return img

def add_text_overlay(img, text, position="bottom", alpha=255):
    """Add text overlay"""
    overlay = img.copy().convert('RGBA')
    draw = ImageDraw.Draw(overlay, 'RGBA')

    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 28)
        small_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 20)
    except:
        font = small_font = None

    if position == "bottom":
        draw.rectangle([0, HEIGHT - 120, WIDTH, HEIGHT], fill=(0, 0, 0, int(200 * alpha / 255)))
        text_bbox = draw.textbbox((0, 0), text, font=font)
        text_width = text_bbox[2] - text_bbox[0]
        x = (WIDTH - text_width) // 2
        y = HEIGHT - 70
        draw.text((x, y), text, fill=(255, 255, 255, alpha), font=font)
    elif position == "top":
        badge_width = 450
        badge_height = 90
        badge_x = WIDTH - badge_width - 30
        badge_y = 30
        draw.rounded_rectangle([badge_x, badge_y, badge_x + badge_width, badge_y + badge_height],
                              radius=15, fill=(7, 94, 84, int(240 * alpha / 255)))
        lock_x = badge_x + 25
        lock_y = badge_y + 20
        draw.text((lock_x, lock_y), "🔒", font=font)
        draw.text((lock_x + 50, badge_y + 18), "100% Private", fill=(255, 255, 255, alpha), font=font)
        draw.text((lock_x + 50, badge_y + 52), "All processing on your device",
                 fill=(255, 255, 255, alpha), font=small_font)

    return overlay.convert('RGB')

# Timeline - increased durations to ensure audio completes
timeline = [
    (3.5, "Welcome to WhatsApp Chat Summarizer, a completely private Chrome extension.", "intro", False),
    (3.0, "Here's WhatsApp Web with your private conversations.", "whatsapp", False),
    (2.5, "Click the extension icon to open the summarizer.", "opening", False),
    (3.5, "All processing happens locally on your device using Chrome's built-in Gemini Nano AI.", "privacy", True),
    (3.5, "Your messages are never sent to external servers. Everything stays in your browser.", "loading", True),
    (3.0, "The AI generates a summary instantly, right on your device.", "summary", True),
    (5.0, "You can read, copy, or have the summary read aloud. All completely private and secure.", "final", True),
]

print("Generating voice narration...")
temp_dir = "/tmp/whatsapp_demo"
os.makedirs(temp_dir, exist_ok=True)
audio_files = []

for i, (duration, text, scene, badge) in enumerate(timeline):
    audio_file = f"{temp_dir}/narration_{i}.aiff"
    subprocess.run(['say', '-v', 'Samantha', '-o', audio_file, text], check=True)
    audio_files.append(audio_file)
    print(f"  ✓ Generated narration {i+1}/{len(timeline)}")

print("\nGenerating video frames...")
frames_dir = f"{temp_dir}/frames"
os.makedirs(frames_dir, exist_ok=True)

base = create_base_frame()
frame_count = 0

for i, (duration, text, scene, show_badge) in enumerate(timeline):
    num_frames = int(duration * FPS)
    print(f"  Scene {i+1}/{len(timeline)}: {scene} ({num_frames} frames)")

    for f in range(num_frames):
        progress = f / num_frames

        if scene == "intro":
            frame = base.copy()
            alpha = min(255, int(progress * 255 * 3))
            frame = add_text_overlay(frame, "WhatsApp Chat Summarizer", "bottom", alpha)
        elif scene == "whatsapp":
            frame = base.copy()
            frame = add_text_overlay(frame, "Your private conversations", "bottom", 255)
        elif scene == "opening":
            anim_progress = ease_out_cubic(min(1.0, progress * 1.5))
            frame = create_frame_with_extension(base, anim_progress, False, 0)
            frame = add_text_overlay(frame, "Click extension to summarize", "bottom", 255)
        elif scene == "privacy":
            frame = create_frame_with_extension(base, 1.0, False, 0)
            badge_alpha = int(ease_out_cubic(min(1.0, progress * 2)) * 255)
            frame = add_text_overlay(frame, "Processing with Gemini Nano", "bottom", 255)
            if show_badge:
                frame = add_text_overlay(frame, "", "top", badge_alpha)
        elif scene == "loading":
            frame = create_frame_with_extension(base, 1.0, True, 0)
            frame = add_text_overlay(frame, "No data sent to servers", "bottom", 255)
            if show_badge:
                frame = add_text_overlay(frame, "", "top", 255)
        elif scene == "summary":
            summary_progress = ease_out_cubic(min(1.0, progress * 1.5))
            frame = create_frame_with_extension(base, 1.0, False, summary_progress)
            frame = add_text_overlay(frame, "Generated on your device", "bottom", 255)
            if show_badge:
                frame = add_text_overlay(frame, "", "top", 255)
        elif scene == "final":
            frame = create_frame_with_extension(base, 1.0, False, 1.0)
            frame = add_text_overlay(frame, "Private, secure, instant", "bottom", 255)
            if show_badge:
                frame = add_text_overlay(frame, "", "top", 255)

        frame.save(f"{frames_dir}/frame_{frame_count:05d}.png")
        frame_count += 1

# Add extra frames at the end to ensure video is longer than audio
print(f"  Adding buffer frames to ensure audio completes...")
final_frame = create_frame_with_extension(base, 1.0, False, 1.0)
final_frame = add_text_overlay(final_frame, "Private, secure, instant", "bottom", 255)
final_frame = add_text_overlay(final_frame, "", "top", 255)

# Add 5 seconds of buffer frames (150 frames at 30fps) to ensure video is longer than audio
for i in range(150):
    final_frame.save(f"{frames_dir}/frame_{frame_count:05d}.png")
    frame_count += 1

print(f"  ✓ Generated {frame_count} frames")

print("\nCombining audio files...")
audio_list_file = f"{temp_dir}/audio_list.txt"
with open(audio_list_file, 'w') as f:
    for audio_file in audio_files:
        f.write(f"file '{audio_file}'\n")

combined_audio = f"{temp_dir}/narration_combined.aiff"
subprocess.run([
    'ffmpeg', '-f', 'concat', '-safe', '0', '-i', audio_list_file,
    '-c', 'copy', combined_audio, '-y'
], check=True, capture_output=True)
print("  ✓ Audio combined")

print("\nCreating MP4 video...")
output_video = os.path.join(os.path.dirname(__file__), 'demo.mp4')

subprocess.run([
    'ffmpeg',
    '-framerate', str(FPS),
    '-i', f"{frames_dir}/frame_%05d.png",
    '-i', combined_audio,
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-af', 'volume=6.0',  # Moderate volume boost without echo/distortion
    '-c:a', 'aac',
    '-b:a', '256k',  # Higher bitrate for clearer audio
    output_video,  # Removed -shortest to let audio complete
    '-y'
], check=True)

print(f"\n✓ Video created: {output_video}")
print(f"  Resolution: {WIDTH}x{HEIGHT}")
print(f"  FPS: {FPS}")
print(f"  Duration: ~{sum(d for d, _, _, _ in timeline):.1f} seconds")

subprocess.run(['rm', '-rf', temp_dir], check=True)
print("  ✓ Cleanup complete")
