To Do:

address css mobile: move the submit order card to buttom 

Manage admin page to controll customer pages 
= Can customize header on each pages
= connect to any category
= 

Admin order pages:
= view orders filters
= confirm order (choose what item is unavailable or need price update)
= refund order
= manage order status
= delivery estimation
= add message to reply to order via telegram and gmail
= 

User page:
= view order
= filter order by status
= awaiting payment
= awaiting review
= request refund on unsuccessful order

~ = setting:
= view ID
= username
= phone number/telegram
= gmail

integrate bot:
https://share.google/aimode/rxWpCyxlrNJ3ENX3D
= recieve orders
= recieve payment alert (want this to connect with OrderID)

aba payway integration:
https://developer.payway.com.kh/

redesign database in canva for better understanding

update login and signup pages ui

front end varaint logic: for product with charcater name just let them note in order

~ change customer option name to varaint because we dropped product option and replaced with variant instead

if order has not been confirmed by admin yet, admin can modify the order and customer will see it is marked as modified by admin and they need to confirm the modified then the order would be move to confirmed by dafault seen the admin already look at it and modify it. Also since my store policy is that customer can pick between full payment (include shipping) or they can pay 50% first for pre order item then pay the rest when its arrived. Plus, cash on delivery is available for the last 50% and product that are instock but only if location in pp would cash on delivery be possible. for province always full payment before shipping so here is the flow.
 1. customer order pre order product: pay 50% -> order sent -> awaiting confirmation => confirmed -> shipped -> deliveried
 2. customer order instock product (inventory is not 0): fill address, make a feild where we make a check box asking if location is in phnom penh => if phnom penh ask if they want cash on delivery or full paymnet on website -> order sent -> awaiting confirmation -> confirmed -> shipped -> deliveried
 3. customer order both pre order and instock product: same logic as pre order product
As for admin flow in case we need to modify order  (modify only available if order is not confirmed) it will show to customer that their order has a modified status and they will received a notification (implementing later) -> customer confirm the modified -> admin see it is confirmed

~ add wishlist to userpage 

~ clicking on product in cart will take customer to that product page

~ get cart-badge working on every pages and mobile.

i notice if a product is pre order it show in the product page but instock doesnt have instock label, i want each all to have its own label so customer will know.

clicking on order from the order history will show full detail of order and what has been modified by admin check show rather customer confirm/reject/contact store (if the order was modify by admin before or after confirming it has to be in the customer awaiting action status, this status is waiting for customer to answer to the modified and also use when awaiting the other half payment sent by admin by making the order status "awaiting final payment" and show pay final bill button to them) 