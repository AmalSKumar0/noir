import keyring

SERVICE = "noir"


def save_refresh_token(token: str):
    keyring.set_password(SERVICE, "refresh", token)


def get_refresh_token():
    return keyring.get_password(SERVICE, "refresh")


def delete_refresh_token():
    try:
        keyring.delete_password(SERVICE, "refresh")
    except Exception:
        pass