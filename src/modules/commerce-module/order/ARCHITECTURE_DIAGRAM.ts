/**
 * ORDER SERVICE ARCHITECTURE DIAGRAM
 *
 * BEFORE REFACTORING:
 * ┌─────────────────────────────────────────────────────────────┐
 * │                     OrderService                            │
 * │  (910 lines - monolithic)                                   │
 * │                                                             │
 * │  • Validation                                               │
 * │  • Order Creation (Offline, Online, Panda)                  │
 * │  • Payment Verification                                     │
 * │  • Order Queries                                            │
 * │  • Order Management                                         │
 * │  • Status Updates                                           │
 * │  • Cancellations                                            │
 * └─────────────────────────────────────────────────────────────┘
 *
 *
 * AFTER REFACTORING:
 *
 *                    ┌──────────────────────┐
 *                    │   OrderService       │
 *                    │   (Orchestrator)     │
 *                    │   ~170 lines         │
 *                    └──────────┬───────────┘
 *                               │
 *              ┌────────────────┼────────────────┐
 *              │                │                │
 *              ▼                ▼                ▼
 *    ┌─────────────────┐ ┌─────────────┐ ┌──────────────────┐
 *    │ OrderValidation │ │ OrderQuery  │ │ OrderManagement  │
 *    │    Service      │ │   Service   │ │     Service      │
 *    │   ~75 lines     │ │ ~145 lines  │ │    ~85 lines     │
 *    └─────────────────┘ └─────────────┘ └──────────────────┘
 *              │                │                │
 *              └────────────────┼────────────────┘
 *                               │
 *              ┌────────────────┴────────────────┐
 *              ▼                                 ▼
 *    ┌─────────────────────┐         ┌──────────────────────────┐
 *    │  OrderCreation      │         │ OrderPaymentVerification │
 *    │     Service         │         │        Service           │
 *    │   ~550 lines        │         │      ~145 lines          │
 *    └─────────────────────┘         └──────────────────────────┘
 *
 *
 * CONTROLLER LAYER (No Changes Required):
 * ┌─────────────────────────────────────────────────────────────┐
 * │  OrderController  │  PandaOrderController  │  PaymentController│
 * └─────────────────────────────────────────────────────────────┘
 *                               │
 *                               ▼
 *                    ┌──────────────────────┐
 *                    │   OrderService       │
 *                    │   (Delegates)        │
 *                    └──────────────────────┘
 *
 *
 * KEY BENEFITS:
 * ✓ Single Responsibility Principle
 * ✓ Easier to test and maintain
 * ✓ Better code organization
 * ✓ Reduced cognitive complexity
 * ✓ Backward compatible (no breaking changes)
 * ✓ Easier team collaboration
 *
 *
 * SERVICE RESPONSIBILITIES:
 *
 * 1. OrderValidationService
 *    - Validate order items
 *    - Build validated items
 *    - Group by vendor
 *
 * 2. OrderCreationService
 *    - Create offline orders
 *    - Create online orders (with/without escrow)
 *    - Create Pandascrow orders
 *    - Handle payment initialization
 *
 * 3. OrderQueryService
 *    - Get orders by reference
 *    - Get orders by user/vendor
 *    - Handle pagination
 *    - Manage relations
 *
 * 4. OrderManagementService
 *    - Update order status
 *    - Cancel orders
 *    - Mark paid/completed
 *
 * 5. OrderPaymentVerificationService
 *    - Verify Paystack payments
 *    - Handle multi-order payments
 *    - Coordinate post-payment actions
 */
