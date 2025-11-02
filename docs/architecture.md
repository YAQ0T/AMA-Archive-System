# Architecture Notes

## Storage Strategy Evaluation
Two primary options were evaluated for storing digitized AMA binaries: MongoDB GridFS and a dedicated filesystem/object storage.

### MongoDB GridFS
**Pros**
- Native integration with MongoDB transactions and replica sets, ensuring metadata and binaries share durability characteristics.
- Simplified deployment footprint—single data layer for metadata and files.
- Built-in chunking and streaming APIs ease handling of large scans from Node.js.
- Facilitates co-locating binaries with metadata for backup/restore workflows.

**Cons**
- Higher storage overhead due to chunking and metadata documents.
- Throughput limited by MongoDB cluster performance; scaling for heavy media workloads may require sharding.
- More complex to serve binaries directly to CDN/static hosting without intermediary API.

### Filesystem / Object Storage (e.g., NFS, S3-compatible)
**Pros**
- Optimized for large binary storage with better cost and performance characteristics.
- Can integrate with CDN for efficient delivery of public assets.
- Supports lifecycle rules and versioning at storage-provider level.

**Cons**
- Requires additional infrastructure and consistency management between metadata (MongoDB) and file storage.
- Adds complexity for local development and automated testing.
- Permissions and access control must be replicated outside MongoDB.

### Decision
Adopt **MongoDB GridFS** for initial implementation to minimize operational complexity and keep metadata and binaries within a single managed platform. This decision should be revisited once ingestion volume exceeds projected thresholds ( >2 TB/year ) or when integration with CDN distribution becomes a priority. The system will abstract storage interactions behind a service layer to ease future migration if an object store becomes necessary.

## Implications
- Node.js API leverages the official MongoDB driver and GridFSBucket for streaming uploads/downloads.
- Backup strategy must account for increased MongoDB storage size; leverage incremental backups and compression.
- Binary integrity checks operate via GridFS file IDs and stored checksums.
- Document metadata continues to reference binaries via `binaryLocation` storing the GridFS ObjectId.
