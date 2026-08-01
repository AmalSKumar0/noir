import keyring

SERVICE = "noir"


def save_token(token: dict):
    keyring.set_password(SERVICE, "refresh", token["refresh"])
    keyring.set_password(SERVICE, "access", token["access"])


def get_refresh_token():
    return keyring.get_password(SERVICE, "refresh")

def get_access_token():
    return keyring.get_password(SERVICE, "access")

def delete_token():
    try:
        keyring.delete_password(SERVICE, "refresh")
        keyring.delete_password(SERVICE, "access")
    except Exception:
        pass

def is_token_valid():
    if keyring.get_password(SERVICE, "refresh") or keyring.get_password(SERVICE, "access"):
        return False
    else:
        return True