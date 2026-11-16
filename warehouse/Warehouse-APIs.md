# Warehouse Management APIs

This document summarises all 21 functions defined under **Warehouse Management**, all 9 **Warehouse Interface** functions, and supporting APIs in other components that connect to warehouse workflows. Descriptions are paraphrased from the architecture document.

The PDF defines function signatures and named result types. It does not specify HTTP methods, URL paths, or complete request/response schemas for these functions. Names and identifier capitalisation below follow the PDF; line wrapping and punctuation are normalised.

## Warehouse Management

Warehouse Management tracks ordered items from incoming supplier packages through storage, consolidation, packing, and vehicle loading. It also records returns and reports progress to Order Management and Tracking.

### Order and incoming-package registration

#### `ProcessingStatus processConfirmedOrder(orderId, items)`

Registers a paid customer order and its items for warehouse processing, including Item IDs, delivery destinations, and handling requirements. Items awaiting supplier delivery remain pending until received, after which they can be considered for consolidation and packing. Returns the initial processing status or a reason the order could not be accepted.

#### `IncomingPackageResult registerIncomingPackage(supplierPackageId, supplierOrderId, trackingRef, itemIds)`

Registers an expected supplier package, linking its ID, supplier order, tracking reference, and expected Item IDs. This lets staff identify the package and its expected contents when it arrives. Returns registration confirmation or an error.

#### `IncomingPackageList getIncomingPackages(itemIds)`

Retrieves the supplier packages associated with the specified items, including expected contents, warehouse receipt status, and available arrival estimates. Tracking uses the result while items await arrival or consolidation. Explicitly identifies items without a registered package and arrival estimates that are missing or outdated.

### Receiving and storage

#### `ReceiveResult receiveIncomingPackage(supplierPackageId)`

Validates an arriving supplier package against its registration, records its arrival, and returns the expected Item IDs for unloading checks. Recognises repeated receipt scans without recording another arrival and rejects unknown packages. Package receipt does not confirm that every expected item was present; items still need individual processing into storage.

#### `MatchResult matchUnlabelledItem(supplierId, productId, quantity)`

Matches goods without individual labels to outstanding expected items using the supplier, product, and quantity. Checks that the quantity does not exceed what is still expected. Returns matching customer Item IDs when the match is unique, or an ambiguity/discrepancy requiring staff review before storage.

#### `StorageAssignment assignStorageLocation(itemId)`

Checks that an item exists and can enter storage, then selects a suitable location using available space and recorded storage requirements. Returns the location and handling instructions, or explains why assignment failed. Physical placement is confirmed separately.

#### `StoreResult confirmItemStored(itemId, storageLocationId)`

Confirms that staff physically placed an item in its assigned storage location. Validates the item state and location, updates the recorded location and status, and reports progress to Order Management and Tracking. Returns confirmation or an error, such as an incorrect location. Repeated confirmations do not create duplicate movements.

### Consolidation and packing

#### `PackagingRequest getPackagingRequest()`

Retrieves the next packing job using destination groups supplied by Order Management, stored-item availability, and the three-day consolidation rule. Returns a unique packaging request ID, expected Item IDs, storage locations, and destination, or indicates that no job is available. Prevents the same active request from being independently allocated to multiple packing operations.

#### `PackageID createPackage(packagingRequestId)`

Creates an outgoing package record for a valid packing request and links it to the expected items and customer orders. Returns its unique Package ID. Rejects invalid or completed requests and recognises repeated creation requests to avoid duplicate packages. Contents still need to be scanned before the package can become ready for dispatch.

#### `ScanResult addItemToPackage(packageId, itemId)`

Validates an item scan during packing: the item must be expected, available, and not already assigned or scanned into another package. Records an accepted placement and updates packing progress and item records. Returns acceptance and outstanding items, or a rejection reason such as a duplicate scan, incorrect item, or closed package.

#### `MissingItemResult reportMissingItem(packageId, itemId)`

Records that an expected packing item cannot be found. Validates that the item belongs to the package's expected contents, records the discrepancy, and puts the affected packing work on hold. Updates item and order progress and returns the required follow-up. Cancellation and refund decisions remain with Order Management.

#### `ReadyResult setPackageReady(packageId, weight, dimensions)`

Completes packing after checking that all required items have been scanned and discrepancies resolved. Marks the package ready for vehicle allocation and loading, and reports package and item progress to Order Management and Tracking. Returns confirmation or the reason readiness could not be established. Readiness does not confirm physical loading.

### Vehicle allocation and loading

#### `PackageAssignResult assignPackagesToVehicles(packageIds, vehicleIds)`

Allocates ready packages to available vehicles using capacity, destinations, and operational restrictions. Checks readiness, vehicle availability, and existing allocations before recording assignments. Returns successful assignments and reasons for any unallocated packages. Route Planning subsequently determines stop order and navigation.

#### `LoadInstruction getLoadInstruction(packageId)`

Retrieves loading instructions for a ready package with a valid vehicle assignment. Returns its warehouse collection location, assigned vehicle, and recorded handling or loading-sequence information, or an error if loading cannot proceed. Reading the instruction does not change the package's loading state.

#### `LoadScanResult confirmPackageLoaded(packageId, vehicleId)`

Records a scan confirming physical loading onto the specified vehicle. Checks that the package is ready and assigned to that vehicle, then updates the vehicle load record and package state. Recognises duplicate scans and returns confirmation or a validation error. Complete-load finalisation and delivery-task registration happen separately.

#### `LoadConfirmationResult confirmPackagesLoaded(roundId, vehicleId, packageIds)`

Finalises a vehicle load by checking packages against recorded loading scans and the vehicle's assigned round. Calls Delivery and Collection Management's `registerLoadedPackages`, then links returned delivery task IDs to package and order records. Reports packages with invalid scans or unsuccessful task registration as unresolved. Repeated finalisation preserves existing registrations; only successfully confirmed and registered packages enter the finalised load.

### Package information

#### `PackageInfo getPackageInfo(packageId)`

Retrieves package contents, linked orders, processing state, location, vehicle assignment, and any assigned delivery task reference. Supports Tracking while a package is being prepared or has no delivery task. Rejects unknown packages and unauthorised callers. Delivery outcomes and driving ETAs come from Delivery and Collection Management and Route Planning respectively.

#### `PackageStatus getPackageStatus(packageID)`

Retrieves only the package's current warehouse processing state, such as being packed, ready for loading, loaded, or received back. Provides a smaller lookup than `getPackageInfo` for deciding the next permitted warehouse action. Unknown packages and unauthorised requests produce errors. Customer tracking milestones and delivery outcomes are handled by other components.

### Returns and package retirement

#### `ReturnAcceptance initiateReturn(orderId, itemIds)`

Called by Order Management after it accepts the selected items as eligible for return. Checks that the items belong to the order and creates a return-processing record. Returns acceptance and a return reference, or explains why processing could not begin. Physical receipt and refunds are recorded separately.

#### `ReturnedPackageResult receiveReturnedPackage(packageId)`

Records physical receipt of a known package after a customer return or unsuccessful delivery. Links it to the existing return or delivery record, marks it as awaiting contents and condition checks, and updates Order Management and Tracking. Recognises repeated receipts without duplication. Receipt alone does not approve restocking or a refund.

#### `void deletePackage(packageId)`

Archives a package after checking caller authority and ensuring no loading, delivery, or return work remains unresolved. Removes it from active operational lists while preserving order references and tracking history. Unknown packages and active dependencies produce errors through the standard API error mechanism.

## Warehouse Interface

These functions present warehouse information and guide staff actions. Warehouse Management validates and records the underlying operations.

| Function signature | What it does |
| --- | --- |
| `void displayReceivedItems(ReceiveResult result)` | Shows the incoming package, expected contents, receipt warnings, and errors. Distinguishes expected items from confirmed physical receipts and guides staff towards matching and storage. |
| `void displayStorageAssignment(StorageAssignment assignment)` | Shows the assigned storage location and handling instructions, or why assignment failed. Supports submitting a placement confirmation through `confirmItemStored` and displaying its result. |
| `void displayPackagingRequest(PackagingRequest request)` | Shows the packing request ID, required items and quantities, storage locations, and destination. Guides collection and scanning, displays progress, and supports submitting missing-item reports and other exceptions. |
| `void displayScanResult(ScanResult result)` | Shows whether a packing scan was accepted, rejected, or recognised as a duplicate, together with corrective actions. Updates displayed packing progress and remaining contents. Loading scans use a separate result contract. |
| `void displayLoadInstruction(LoadInstruction instruction)` | Shows the package, warehouse location, assigned vehicle, handling guidance, and loading sequence. Guides staff to scan the package and vehicle and submit confirmation; displays assignment warnings or errors. |
| `void displayAccessDenied()` | Shows that the user lacks permission, withholds restricted information, and provides a next action such as signing in with an authorised account. Service-side permission checks remain responsible for enforcement. |
| `void displayPackageList()` | Retrieves and displays the operational package list across preparation, allocation, loading, and return, including states, destinations permitted for the caller, vehicle assignments, and exceptions. Refreshes after changes and handles empty/error states. |
| `void displayWarehouseItems()` | Shows warehouse items, locations, and processing states, with search and filtering. Identifies goods awaiting storage, packing, or investigation and shows unavailable or outdated information explicitly. |
| `void displayWarehousePackages()` | Shows prepared packages awaiting dispatch, including readiness, vehicle assignments, and blocking issues. Packages leave this view when their load is finalised but remain in the broader package list. |

## Supporting APIs in other components

These related functions belong to the named components rather than Warehouse Management.

### Order Management

| Function signature | Warehouse-related purpose |
| --- | --- |
| `void updateOrderStatus(orderId, newStatus)` | Stores an order's processing status received from Warehouse Management. |
| `void updateOrderItemStatus(orderId, itemId, newStatus)` | Updates an individual ordered item's processing status so its progress can be tracked independently. |
| `void updateOrderPackage(orderId, packageId, itemIds, taskId)` | Records which items belong to an outgoing package and its delivery task. The task ID is initially absent at packing and is added after vehicle loading and task assignment. |
| `ReturnResult requestReturn(orderId, ItemIds)` | Checks return eligibility and requests warehouse return processing. Requests a collection task after acceptance, saves its ID, and marks items Awaiting Collection; keeps the return pending scheduling if task creation fails. |
| `GroupingResult groupOrderByDestination(orderIds)` | Retrieves orders and groups their items by delivery destination for warehouse processing. |
| `SupplierPackageResult registerSupplierPackage(supplierOrderId, trackingRef, packageItems)` | Creates the incoming Supplier Package ID and records the supplier order, tracking details, and Item IDs. Calls Warehouse Management's `registerIncomingPackage` to register the expected arrival. |

### Tracking

| Function signature | Warehouse-related purpose |
| --- | --- |
| `void setPackageTrackingStatus(packageId, status)` | Accepts tracking updates from authorised components such as Warehouse Management. Validates the package and status, appends a tracking event, and updates current state where appropriate. Suppresses duplicate events and prevents delayed events from replacing a newer state. |

### Delivery and Collection Management

| Function signature | Warehouse-related purpose |
| --- | --- |
| `DeliveryRegistrationResult registerLoadedPackages(roundId, vehicleId, packages)` | Registers loaded vehicle packages as delivery tasks on the round and returns their task IDs. Called when Warehouse Management finalises a load. |
| `CollectionTaskResult createReturnCollection(returnId, orderId, itemIds, collectionAddress)` | Creates a driver collection task for returned items and links it to the original order. Returns the task ID for Order Management to associate with the accepted return, or a failure reason. |

## Workflow notes

- **Receiving and storage:** Register expected packages, record package arrival, identify individual items, assign storage, then confirm physical placement. An arrival scan alone does not confirm all expected contents.
- **Consolidation and packing:** Group items by destination and apply the three-day consolidation rule before offering packing work. Create the package, scan its contents, resolve discrepancies, and mark it ready. The PDF names the rule but does not define its exact timing calculation in these API descriptions.
- **Loading:** Assign packages to vehicles, retrieve instructions, confirm each physical load scan, then finalise the load and register delivery tasks. Missing or mismatched scans must be corrected before confirmation.
- **Returns:** Return acceptance, collection scheduling, physical warehouse receipt, contents/condition checks, and refund approval are separate steps.
