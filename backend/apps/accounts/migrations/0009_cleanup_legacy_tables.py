from django.db import migrations


def drop_legacy_tables(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        if schema_editor.connection.vendor == 'postgresql':
            cursor.execute("DROP TABLE IF EXISTS companies_developerinvitation CASCADE;")
            cursor.execute("DROP TABLE IF EXISTS companies_company CASCADE;")
            cursor.execute("DROP TABLE IF EXISTS notifications_notification CASCADE;")
        else:
            cursor.execute("DROP TABLE IF EXISTS companies_developerinvitation;")
            cursor.execute("DROP TABLE IF EXISTS companies_company;")
            cursor.execute("DROP TABLE IF EXISTS notifications_notification;")


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0008_developerteam'),
    ]

    operations = [
        migrations.RunPython(drop_legacy_tables, reverse_code=migrations.RunPython.noop),
    ]
