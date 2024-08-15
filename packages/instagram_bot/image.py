import io

from models import Inspector
from PIL import Image, ImageDraw, ImageFont


def create_image(inspector: Inspector) -> io.BytesIO:
    aspect_ratio = 9 / 16
    width = 1080
    height = int(width / aspect_ratio)

    # Create a new image with a black background
    img = Image.new('RGB', (width, height), color='black')
    d = ImageDraw.Draw(img)

    # Load the default font
    large_font = ImageFont.load_default().font_variant(size=40)

    # Add the text to the image
    d.text((50, 50), f'Station: {inspector.station}', fill='white', font=large_font)
    d.text((50, 100), f'Linie: {inspector.line}', fill='white', font=large_font)
    d.text((50, 150), f'Richtung: {inspector.direction}', fill='white', font=large_font)

    # Add the message with a margin
    d.multiline_text((50, 250), inspector.message, fill='white', font=large_font, spacing=10)

    # Save the image to a bytes buffer
    img_byte_arr = io.BytesIO()
    img.save(img_byte_arr, format='PNG')
    img_byte_arr.seek(0)

    return img_byte_arr
