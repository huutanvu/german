import sys
import os

try:
    from gtts import gTTS
except ImportError:
    print("Error: The 'gTTS' library is not installed.")
    print("Please install it using: pip install gTTS")
    sys.exit(1)

def main():
    if len(sys.argv) < 3:
        print("Usage: python generate_tts.py <text_or_file_path> <output_file_path>")
        sys.exit(1)
        
    input_data = sys.argv[1]
    output_path = sys.argv[2]
    
    # Check if input is a file path or direct text
    if os.path.isfile(input_data):
        with open(input_data, 'r', encoding='utf-8') as f:
            text = f.read()
    else:
        text = input_data
        
    print(f"Synthesizing text: '{text[:50]}...'")
    try:
        tts = gTTS(text=text, lang='de', slow=False)
        tts.save(output_path)
        print(f"Saved audio to {output_path}")
    except Exception as e:
        print(f"Error during TTS generation: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
