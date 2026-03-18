"""
MQTT Manager — handles connection to Mosquitto and all publish operations.
Supports MQTT Discovery for automatic Home Assistant entity creation.
Supports multi-property notify topics.
"""

import json
import logging
import os
import time
import threading
import paho.mqtt.client as mqtt

logger = logging.getLogger(__name__)

BROKER      = os.getenv("MQTT_BROKER", "")
PORT        = int(os.getenv("MQTT_PORT", "1883"))
USERNAME    = os.getenv("MQTT_USERNAME", "")
PASSWORD    = os.getenv("MQTT_PASSWORD", "")
BASE_TOPIC  = "homemaint"
DISC_PREFIX = "homeassistant"


class MQTTManager:
    def __init__(self):
        self._client    = None
        self._connected = False
        self._lock      = threading.Lock()

    def connect(self):
        if not BROKER:
            logger.warning("MQTT_BROKER not set — MQTT disabled")
            return False
        try:
            client = mqtt.Client(
                client_id=f"homemaint-{os.getpid()}",
                clean_session=True,
                protocol=mqtt.MQTTv311,
            )
            if USERNAME:
                client.username_pw_set(USERNAME, PASSWORD)

            client.on_connect    = self._on_connect
            client.on_disconnect = self._on_disconnect

            client.will_set(f"{BASE_TOPIC}/status", "offline", retain=True)
            client.connect(BROKER, PORT, keepalive=60)
            client.loop_start()

            # Wait up to 5s for connection
            for _ in range(50):
                if self._connected:
                    break
                time.sleep(0.1)

            if self._connected:
                self._client = client
                self.publish(f"{BASE_TOPIC}/status", "online", retain=True)
                logger.info(f"MQTT connected to {BROKER}:{PORT}")
                return True
            else:
                logger.error(f"MQTT connection timeout to {BROKER}:{PORT}")
                return False

        except Exception as e:
            logger.error(f"MQTT connect error: {e}")
            return False

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self._connected = True
        else:
            codes = {1:"bad protocol", 2:"bad client id", 3:"server unavailable", 4:"bad credentials", 5:"not authorized"}
            logger.error(f"MQTT connect refused: {codes.get(rc, rc)}")

    def _on_disconnect(self, client, userdata, rc):
        self._connected = False
        if rc != 0:
            logger.warning(f"MQTT unexpected disconnect (rc={rc})")

    @property
    def connected(self):
        return self._connected

    def publish(self, topic, payload, retain=False, qos=1):
        if not self._client or not self._connected:
            return False
        try:
            p = json.dumps(payload) if isinstance(payload, dict) else str(payload)
            self._client.publish(topic, p, qos=qos, retain=retain)
            return True
        except Exception as e:
            logger.error(f"MQTT publish error on {topic}: {e}")
            return False

    def disconnect(self):
        if self._client:
            self.publish(f"{BASE_TOPIC}/status", "offline", retain=True)
            self._client.loop_stop()
            self._client.disconnect()
            self._connected = False

    # ── MQTT Discovery ────────────────────────────────────────────────────

    def register_task_sensor(self, property_id, property_name, asset_id, asset_name, task_id, task_name):
        """Publish MQTT Discovery config for a task sensor."""
        unique_id   = f"homemaint_task_{task_id}"
        state_topic = f"{BASE_TOPIC}/{property_id}/{asset_id}/{task_id}/state"
        attr_topic  = f"{BASE_TOPIC}/{property_id}/{asset_id}/{task_id}/attributes"
        disc_topic  = f"{DISC_PREFIX}/sensor/{unique_id}/config"

        config = {
            "name":                  f"HM: {asset_name} — {task_name}",
            "unique_id":             unique_id,
            "state_topic":           state_topic,
            "json_attributes_topic": attr_topic,
            "icon":                  "mdi:wrench-clock",
            "device": {
                "identifiers":  [f"homemaint_{property_id}"],
                "name":         f"HomeMaint: {property_name}",
                "model":        "HomeMaint",
                "manufacturer": "HomeMaint",
            },
            "availability": [
                {"topic": f"{BASE_TOPIC}/status", "payload_available": "online", "payload_not_available": "offline"}
            ],
        }
        self.publish(disc_topic, config, retain=True)

    def register_property_sensor(self, property_id, property_name):
        """Summary sensor per property — state = overdue count."""
        unique_id  = f"homemaint_property_{property_id}"
        disc_topic = f"{DISC_PREFIX}/sensor/{unique_id}/config"
        config = {
            "name":        f"HM: {property_name}",
            "unique_id":   unique_id,
            "state_topic": f"{BASE_TOPIC}/{property_id}/summary",
            "value_template": "{{ value_json.overdue_count }}",
            "json_attributes_topic": f"{BASE_TOPIC}/{property_id}/summary",
            "unit_of_measurement": "tasks",
            "icon": "mdi:home-alert",
            "device": {
                "identifiers": [f"homemaint_{property_id}"],
                "name":        f"HomeMaint: {property_name}",
                "model":       "HomeMaint",
                "manufacturer":"HomeMaint",
            },
            "availability": [
                {"topic": f"{BASE_TOPIC}/status", "payload_available": "online", "payload_not_available": "offline"}
            ],
        }
        self.publish(disc_topic, config, retain=True)

    def register_property_notify_sensor(self, property_id, property_name):
        """
        Register an MQTT sensor for per-property push notifications.
        HA automation listens on homemaint/{property_id}/notify.
        """
        unique_id  = f"homemaint_notify_{property_id}"
        disc_topic = f"{DISC_PREFIX}/sensor/{unique_id}/config"
        config = {
            "name":        f"HM Notify: {property_name}",
            "unique_id":   unique_id,
            "state_topic": f"{BASE_TOPIC}/{property_id}/notify",
            "value_template": "{{ value_json.title }}",
            "json_attributes_topic": f"{BASE_TOPIC}/{property_id}/notify",
            "icon": "mdi:bell-alert",
            "device": {
                "identifiers": [f"homemaint_{property_id}"],
                "name":        f"HomeMaint: {property_name}",
                "model":       "HomeMaint",
                "manufacturer":"HomeMaint",
            },
            "availability": [
                {"topic": f"{BASE_TOPIC}/status", "payload_available": "online", "payload_not_available": "offline"}
            ],
        }
        self.publish(disc_topic, config, retain=True)

    def register_global_sensor(self):
        """Global rollup sensor."""
        unique_id  = "homemaint_global"
        disc_topic = f"{DISC_PREFIX}/sensor/{unique_id}/config"
        config = {
            "name":        "HomeMaint: All Properties",
            "unique_id":   unique_id,
            "state_topic": f"{BASE_TOPIC}/global/summary",
            "value_template": "{{ value_json.overdue_count }}",
            "json_attributes_topic": f"{BASE_TOPIC}/global/summary",
            "unit_of_measurement": "tasks",
            "icon": "mdi:home-group",
            "availability": [
                {"topic": f"{BASE_TOPIC}/status", "payload_available": "online", "payload_not_available": "offline"}
            ],
        }
        self.publish(disc_topic, config, retain=True)

    # ── State publishing ──────────────────────────────────────────────────

    def publish_task_state(self, property_id, asset_id, task_id, status, days_until_due, usage_until_due, last_done, last_by, escalation_level):
        state_topic = f"{BASE_TOPIC}/{property_id}/{asset_id}/{task_id}/state"
        attr_topic  = f"{BASE_TOPIC}/{property_id}/{asset_id}/{task_id}/attributes"

        self.publish(state_topic, status, retain=True)
        self.publish(attr_topic, {
            "days_remaining":   days_until_due,
            "usage_remaining":  usage_until_due,
            "last_done":        last_done,
            "last_by":          last_by,
            "escalation_level": escalation_level,
        }, retain=True)

    def publish_property_summary(self, property_id, overdue_count, due_soon_count, total_tasks):
        self.publish(f"{BASE_TOPIC}/{property_id}/summary", {
            "overdue_count":  overdue_count,
            "due_soon_count": due_soon_count,
            "total_tasks":    total_tasks,
        }, retain=True)

    def publish_global_summary(self, overdue_count, due_soon_count, total_properties, total_tasks):
        self.publish(f"{BASE_TOPIC}/global/summary", {
            "overdue_count":    overdue_count,
            "due_soon_count":   due_soon_count,
            "total_properties": total_properties,
            "total_tasks":      total_tasks,
        }, retain=True)

    def send_mobile_notification(self, title, message, tag=None, priority="normal", property_id=None):
        """
        Send push notification via HA mobile_app notify service.
        Publishes to:
          - homemaint/{property_id}/notify  (per-property, if property_id given)
          - homemaint/notify                (global fallback, always)
        HA automations can listen on either topic.
        """
        payload = {
            "title":    title,
            "message":  message,
            "tag":      tag or "homemaint",
            "priority": priority,
        }
        # Always publish to global topic
        self.publish(f"{BASE_TOPIC}/notify", payload)
        # Also publish to per-property topic if provided
        if property_id is not None:
            self.publish(f"{BASE_TOPIC}/{property_id}/notify", payload)


# Singleton
mqtt_manager = MQTTManager()
