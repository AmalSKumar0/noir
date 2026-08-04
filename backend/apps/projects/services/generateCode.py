import secrets
import string

alphabet = string.ascii_uppercase + string.digits

def generate_code():
    code = "NR-" + "".join(
        secrets.choice(alphabet) for _ in range(8)
    )
    return code