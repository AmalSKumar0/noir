from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0008_developerteam'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
            DROP TABLE IF EXISTS companies_developerinvitation CASCADE;
            DROP TABLE IF EXISTS companies_company CASCADE;
            DROP TABLE IF EXISTS notifications_notification CASCADE;
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
