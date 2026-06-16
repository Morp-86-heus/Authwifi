import json
import os
import pika

RABBITMQ_URL = os.getenv("RABBITMQ_URL", "amqp://authwifi:authwifi@rabbitmq:5672/")
SURVEY_QUEUE = "survey.send"


def _connect():
    params = pika.URLParameters(RABBITMQ_URL)
    params.heartbeat = 60
    params.blocked_connection_timeout = 30
    conn = pika.BlockingConnection(params)
    ch = conn.channel()
    ch.queue_declare(queue=SURVEY_QUEUE, durable=True)
    return conn, ch


def publish_survey(payload: dict):
    conn, ch = _connect()
    ch.basic_publish(
        exchange="",
        routing_key=SURVEY_QUEUE,
        body=json.dumps(payload),
        properties=pika.BasicProperties(delivery_mode=2),  # persistent
    )
    conn.close()


def consume_survey(callback):
    conn, ch = _connect()
    ch.basic_qos(prefetch_count=1)
    ch.basic_consume(queue=SURVEY_QUEUE, on_message_callback=callback)
    ch.start_consuming()
