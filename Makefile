.PHONY: docker-up docker-down docker-logs
docker-up:
	docker compose up -d --build
docker-down:
	docker compose down
docker-logs:
	docker compose logs -f --tail=100
