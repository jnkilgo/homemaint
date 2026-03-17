"""
Seed database with initial data.
Runs only if the database has no users yet (idempotent).
M9: Properties now require user_id — seeded with admin user's id.
"""

from app.database import SessionLocal
from app.auth import hash_password
from app import models
from datetime import date, datetime


def seed_database():
    db = SessionLocal()
    try:
        if db.query(models.User).first():
            return

        print("Seeding HomeMaint database...")

        # ── Users ──────────────────────────────────────────────
        admin = models.User(
            username="justin",
            display_name="Justin",
            password_hash=hash_password("changeme"),
            role="admin",
            is_verified=True,  # Admin pre-verified
        )
        db.add(admin)
        db.flush()

        # ── Main Property ──────────────────────────────────────
        main_home = models.Property(
            user_id=admin.id,
            name="Main Home",
            address_line1="Rogers, AR",
            property_type="primary",
            is_default=True,
            notes="Primary residence",
        )
        db.add(main_home)
        db.flush()

        # ── ASSETS & TASKS: MAIN HOME ──────────────────────────

        house = models.Asset(
            property_id=main_home.id,
            name="House Systems",
            category="General",
            icon="🏠",
        )
        db.add(house)
        db.flush()

        wf_task = models.Task(
            asset_id=house.id, name="Whole Home Water Filter",
            description="20\" Big Blue housing under utility sink",
            interval=90, interval_type="days", advance_warning_days=14,
            last_completed_at=datetime(2025, 12, 1),
        )
        db.add(wf_task)
        db.flush()
        db.add_all([
            models.Part(task_id=wf_task.id, name="Sediment Filter 20\"",    part_number="Pentek R50-20BB",   supplier="Amazon", last_price=18.00),
            models.Part(task_id=wf_task.id, name="Carbon Filter 20\"",      part_number="Pentek CBC-20BB",   supplier="Amazon", last_price=22.00),
        ])

        ro_task = models.Task(
            asset_id=house.id, name="RO Filters",
            description="6-stage system, kitchen under sink",
            interval=12, interval_type="months", advance_warning_days=30,
            last_completed_at=datetime(2025, 3, 15),
        )
        db.add(ro_task)
        db.flush()
        db.add_all([
            models.Part(task_id=ro_task.id, name="Stage 1 Sediment",    part_number="Pentair EV9270-00", supplier="FiltersFast", last_price=12.00),
            models.Part(task_id=ro_task.id, name="Stage 2/3 Carbon",    part_number="Pentair EV9272-00", supplier="FiltersFast", last_price=14.00),
            models.Part(task_id=ro_task.id, name="RO Membrane 75GPD",   part_number="Pentair EV9276-46", supplier="FiltersFast", last_price=38.00),
            models.Part(task_id=ro_task.id, name="Post Carbon",         part_number="Pentair EV9278-00", supplier="FiltersFast", last_price=11.00),
        ])

        hvac = models.Asset(
            property_id=main_home.id, name="HVAC System",
            category="HVAC", make="Carrier", icon="❄️",
            install_date=date(2018, 6, 1), expected_lifespan_years=15,
            location_on_property="Utility closet / rooftop",
        )
        db.add(hvac)
        db.flush()

        hvac_filter = models.Task(
            asset_id=hvac.id, name="Air Filter Replacement",
            description="20x25x4 media filter, high efficiency",
            interval=3, interval_type="months", advance_warning_days=14,
            last_completed_at=datetime(2026, 1, 10),
        )
        db.add(hvac_filter)
        db.flush()
        db.add(models.Part(task_id=hvac_filter.id, name="Air Filter 20x25x4", part_number="Filtrete MPR 1500 20x25x4", supplier="Home Depot", last_price=29.00))

        hvac_service = models.Task(
            asset_id=hvac.id, name="HVAC Annual Service",
            description="Coil cleaning, refrigerant check, belt inspection",
            interval=12, interval_type="months",
            season="spring", advance_warning_days=30,
            last_completed_at=datetime(2025, 4, 20),
        )
        hvac_service.interval_type = "seasonal"
        db.add(hvac_service)

        smoke = models.Task(
            asset_id=hvac.id, name="Smoke Detector Battery",
            description="7x detectors total, 9V batteries",
            interval=12, interval_type="months", advance_warning_days=30,
            last_completed_at=datetime(2025, 10, 1),
        )
        db.add(smoke)
        db.flush()
        db.add(models.Part(task_id=smoke.id, name="9V Batteries 8-pack", part_number="Energizer 522BP-8", supplier="Costco", last_price=16.00))

        wh = models.Asset(
            property_id=main_home.id, name="Water Heater",
            category="Plumbing", make="Rheem", model="Performance 50",
            install_date=date(2019, 3, 1), expected_lifespan_years=12,
            location_on_property="Utility closet",
            icon="🚿",
        )
        db.add(wh)
        db.flush()
        db.add(models.AssetNote(
            asset_id=wh.id, created_by=admin.id,
            body="Jan 2026 — upper thermostat replaced by R&R Plumbing. Spare Honeywell SP14010B thermostat left on utility closet shelf 2.",
        ))
        db.add(models.SpareInventory(
            asset_id=wh.id, name="Upper Thermostat",
            part_number="Honeywell SP14010B", quantity=1,
            storage_location="Utility closet, shelf 2",
            notes="Left by R&R Plumbing after Jan 2026 repair",
        ))
        db.add(models.Task(
            asset_id=wh.id, name="Anode Rod Inspection",
            description="Inspect and replace if more than 50% depleted",
            interval=2, interval_type="months",
            last_completed_at=datetime(2024, 6, 1),
        ))
        db.add(models.Task(
            asset_id=wh.id, name="Tank Flush",
            description="Flush sediment from bottom of tank",
            interval=12, interval_type="months",
            last_completed_at=datetime(2025, 3, 1),
        ))

        mower = models.Asset(
            property_id=main_home.id, name="Mower",
            category="Equipment", make="Husqvarna",
            model="Z254F", serial_number="",
            current_hours=348, icon="🌿",
            location_on_property="Garage",
        )
        db.add(mower)
        db.flush()

        mow_oil = models.Task(
            asset_id=mower.id, name="Engine Oil Change",
            description="Briggs & Stratton 21hp V-Twin, 2qt capacity",
            interval=50, interval_type="hours", advance_warning_days=10,
            last_completed_at=datetime(2025, 9, 15), last_usage_value=312,
        )
        db.add(mow_oil)
        db.flush()
        db.add_all([
            models.Part(task_id=mow_oil.id, name="Engine Oil SAE 30",    part_number="Briggs 100005E",   supplier="Amazon", last_price=9.00),
            models.Part(task_id=mow_oil.id, name="Oil Filter",           part_number="Briggs 492932S",   supplier="Amazon", last_price=7.00),
        ])

        mow_blades = models.Task(
            asset_id=mower.id, name="Blade Sharpen / Replace",
            description='54" deck, 3-blade setup',
            interval=25, interval_type="hours",
            last_completed_at=datetime(2025, 8, 1), last_usage_value=290,
        )
        db.add(mow_blades)
        db.flush()
        db.add(models.Part(task_id=mow_blades.id, name='Replacement Blade Set 54"', part_number="Oregon 96-626 (3-pack)", supplier="Amazon", last_price=42.00))

        mow_belt = models.Task(
            asset_id=mower.id, name="Drive Belt Inspect/Replace",
            description="Inspect each season, replace if cracked",
            interval=200, interval_type="hours",
            last_completed_at=datetime(2024, 6, 10), last_usage_value=180,
        )
        db.add(mow_belt)
        db.flush()
        db.add(models.Part(task_id=mow_belt.id, name="Deck Drive Belt", part_number="Husqvarna 532144959", supplier="Jack's Small Engines", last_price=28.00))

        mow_spark = models.Task(
            asset_id=mower.id, name="Spark Plugs",
            description="Twin cylinder, 2 plugs total",
            interval=100, interval_type="hours",
            last_completed_at=datetime(2025, 4, 1), last_usage_value=260,
        )
        db.add(mow_spark)
        db.flush()
        db.add(models.Part(task_id=mow_spark.id, name="Spark Plug (2x)", part_number="Champion RC12YC", supplier="Amazon", last_price=5.00))

        db.add(models.Task(
            asset_id=mower.id, name="Winterize / Seasonal Storage",
            description="Fuel stabilizer, drain carb, clean deck, grease fittings",
            interval_type="seasonal", season="fall",
            last_completed_at=datetime(2025, 11, 15),
        ))

        boat = models.Asset(
            property_id=main_home.id, name="Boat",
            category="Watercraft", make="MerCruiser", model="5.0L V8 Alpha One",
            current_hours=261, icon="⛵",
            location_on_property="Lake slip / garage",
        )
        db.add(boat)
        db.flush()

        boat_oil = models.Task(
            asset_id=boat.id, name="Engine Oil Change",
            description="MerCruiser 5.0L V8, 5qt w/ filter",
            interval=100, interval_type="hours",
            last_completed_at=datetime(2025, 5, 20), last_usage_value=215,
        )
        db.add(boat_oil)
        db.flush()
        db.add_all([
            models.Part(task_id=boat_oil.id, name="Marine Engine Oil 5W30", part_number="Quicksilver 8M0078630",    supplier="West Marine", last_price=34.00),
            models.Part(task_id=boat_oil.id, name="Oil Filter",             part_number="Quicksilver 35-866340Q03", supplier="West Marine", last_price=14.00),
        ])

        boat_drive = models.Task(
            asset_id=boat.id, name="Outdrive Fluid",
            description="Alpha One Gen II, ~28oz capacity, check for milky oil",
            interval=100, interval_type="hours",
            last_completed_at=datetime(2025, 5, 20), last_usage_value=215,
        )
        db.add(boat_drive)
        db.flush()
        db.add_all([
            models.Part(task_id=boat_drive.id, name="Gear Lube 32oz",     part_number="Quicksilver 92-8M0058983", supplier="West Marine", last_price=22.00),
            models.Part(task_id=boat_drive.id, name="Drain/Fill Screws",  part_number="Quicksilver 12-19183",     supplier="West Marine", last_price=4.00),
        ])

        boat_spark = models.Task(
            asset_id=boat.id, name="Spark Plugs",
            description='V8 = 8 plugs, gap to .040"',
            interval=300, interval_type="hours",
            last_completed_at=datetime(2024, 5, 10), last_usage_value=130,
        )
        db.add(boat_spark)
        db.flush()
        db.add(models.Part(task_id=boat_spark.id, name="Spark Plug (8x)", part_number="MerCruiser AC-MR43T", supplier="Amazon", last_price=6.00))

        boat_dist = models.Task(
            asset_id=boat.id, name="Distributor Cap & Rotor",
            description="Check for carbon tracking, inspect wires",
            interval=300, interval_type="hours",
            last_completed_at=datetime(2023, 5, 1), last_usage_value=80,
        )
        db.add(boat_dist)
        db.flush()
        db.add_all([
            models.Part(task_id=boat_dist.id, name="Distributor Cap", part_number="MerCruiser 805759A1", supplier="Defender", last_price=38.00),
            models.Part(task_id=boat_dist.id, name="Rotor",           part_number="MerCruiser 816608",   supplier="Defender", last_price=16.00),
        ])

        boat_imp = models.Task(
            asset_id=boat.id, name="Raw Water Impeller",
            description="Critical — failure = overheating. Inspect every season minimum.",
            interval=200, interval_type="hours",
            last_completed_at=datetime(2025, 5, 20), last_usage_value=215,
        )
        db.add(boat_imp)
        db.flush()
        db.add(models.Part(task_id=boat_imp.id, name="Impeller Kit", part_number="Sierra 18-3086", supplier="West Marine", last_price=42.00))

        db.add(models.Task(
            asset_id=boat.id, name="Winterize",
            description="Flush with antifreeze, fog cylinders, stabilize fuel, shrink wrap",
            interval_type="seasonal", season="fall",
            last_completed_at=datetime(2025, 10, 30),
        ))

        rental = models.Property(
            user_id=admin.id,
            name="123 Oak St — Rental",
            address_line1="123 Oak St",
            city="Rogers", state="AR",
            property_type="rental_sfh",
            is_default=False,
        )
        db.add(rental)
        db.flush()

        rental_hvac = models.Asset(
            property_id=rental.id, name="HVAC System",
            category="HVAC", icon="❄️",
            location_on_property="Utility room",
        )
        db.add(rental_hvac)
        db.flush()
        db.add(models.Task(
            asset_id=rental_hvac.id, name="Air Filter Replacement",
            interval=3, interval_type="months",
            last_completed_at=datetime(2025, 11, 1),
        ))

        rental_wh = models.Asset(
            property_id=rental.id, name="Water Heater",
            category="Plumbing", make="AO Smith",
            install_date=date(2020, 1, 15), expected_lifespan_years=12,
            icon="🚿",
        )
        db.add(rental_wh)
        db.flush()
        db.add(models.Task(
            asset_id=rental_wh.id, name="Tank Flush",
            interval=12, interval_type="months",
            last_completed_at=datetime(2025, 1, 1),
        ))

        db.add_all([
            models.PaintRecord(property_id=main_home.id, room_surface="Living Room Walls",   brand="Sherwin-Williams", color_name="Accessible Beige", color_code="SW 7036", sheen="Eggshell",   date_painted=date(2022, 8, 10), painted_by="DIY"),
            models.PaintRecord(property_id=main_home.id, room_surface="Master Bedroom",      brand="Sherwin-Williams", color_name="Repose Gray",       color_code="SW 7015", sheen="Eggshell",   date_painted=date(2022, 8, 15), painted_by="DIY"),
            models.PaintRecord(property_id=main_home.id, room_surface="All Trim / Ceilings", brand="Sherwin-Williams", color_name="Extra White",        color_code="SW 7006", sheen="Semi-Gloss", date_painted=date(2022, 8, 10), painted_by="DIY"),
            models.PaintRecord(property_id=main_home.id, room_surface="Front Door",          brand="Sherwin-Williams", color_name="Naval",              color_code="SW 6244", sheen="Gloss",      date_painted=date(2023, 5, 1),  painted_by="DIY"),
        ])

        db.add(models.Contractor(
            name="R&R Plumbing",
            trade="Plumbing",
            phone="479-555-0100",
            notes="Reliable, same-week availability. Replaced WH thermostat Jan 2026.",
        ))

        db.commit()
        print("Seed complete. Login: justin / changeme")

    except Exception as e:
        db.rollback()
        print(f"Seed error: {e}")
    finally:
        db.close()
