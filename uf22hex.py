import sys
import struct

def convert_uf2_to_hex(uf2_file, hex_file):
    with open(uf2_file, 'rb') as f:
        data = f.read()

    with open(hex_file, 'w') as out:
        num_blocks = len(data) // 512
        extended_addr = -1

        for i in range(num_blocks):
            block = data[i * 512 : (i + 1) * 512]
            
            # Check magic numbers
            magic1 = struct.unpack('<I', block[0:4])[0]
            magic2 = struct.unpack('<I', block[4:8])[0]
            if magic1 != 0x0A324655 or magic2 != 0x9E5D5157:
                continue

            target_addr = struct.unpack('<I', block[12:16])[0]
            payload_size = struct.unpack('<I', block[16:20])[0]
            payload = block[32 : 32 + payload_size]

            # Write extended linear address record if needed
            upper_addr = target_addr >> 16
            if upper_addr != extended_addr:
                extended_addr = upper_addr
                chk = (0x02 + 0x04 + (extended_addr >> 8) + (extended_addr & 0xFF))
                chk = (-(chk) & 0xFF)
                out.write(f":02000004{extended_addr:04X}{chk:02X}\n")

            # Write data records (max 16 bytes per line standard, but we can do payload size)
            # Standard HEX logic
            pos = 0
            while pos < payload_size:
                chunk_len = min(16, payload_size - pos)
                chunk = payload[pos : pos + chunk_len]
                
                addr_offset = (target_addr + pos) & 0xFFFF
                record_type = 0x00
                
                # Checksum calculation
                chk = chunk_len + (addr_offset >> 8) + (addr_offset & 0xFF) + record_type
                for b in chunk:
                    chk += b
                chk = (-(chk) & 0xFF)
                
                hex_data = "".join(f"{b:02X}" for b in chunk)
                out.write(f":{chunk_len:02X}{addr_offset:04X}{record_type:02X}{hex_data}{chk:02X}\n")
                
                pos += chunk_len

        out.write(":00000001FF\n")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python uf22hex.py <input.uf2> <output.hex>")
        sys.exit(1)
    
    convert_uf2_to_hex(sys.argv[1], sys.argv[2])
