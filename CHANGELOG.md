# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning.

## [Unreleased]

### Added

- first package scaffold for the reusable AMQP MCP edge library
- versioned execution job and event contracts with runtime validation
- routing-key and queue naming helpers for edge execution traffic
- AMQP connection manager, job consumer, and event publisher primitives
- in-memory mock edge channel for tests and contract walkthroughs
- RabbitMQ-backed integration test workflow and live end-to-end example
- initial release policy and first-publish guidance

### Changed

- package identity updated to scoped name `@mcp-edge/amqp`
- production build now excludes test compilation outputs from published `dist`
- added reconnect and channel re-initialization workflow in connection lifecycle
- runtime compatibility checks are now enforced by consumer and publisher paths
- publisher now waits for channel drain when AMQP backpressure is signaled

## [0.1.0] - 2026-03-22

### Added

- initial publish candidate for amqp-mcp-edge
- public modules for config, contracts, consumer, publisher, connection, health, and testing
- unit tests covering envelope validation, compatibility validation, routing, and mock round trips