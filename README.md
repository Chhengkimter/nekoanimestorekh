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

~ if order has not been confirmed by admin yet, admin can modify the order and customer will see it is marked as modified by admin and they need to confirm the modified then the order would be move to confirmed by dafault seen the admin already look at it and modify it. Also since my store policy is that customer can pick between full payment (include shipping) or they can pay 50% first for pre order item then pay the rest when its arrived. Plus, cash on delivery is available for the last 50% and product that are instock but only if location in pp would cash on delivery be possible. for province always full payment before shipping so here is the flow.
 1. customer order pre order product: pay 50% -> order sent -> awaiting confirmation => confirmed -> shipped -> deliveried
 2. customer order instock product (inventory is not 0): fill address, make a feild where we make a check box asking if location is in phnom penh => if phnom penh ask if they want cash on delivery or full paymnet on website -> order sent -> awaiting confirmation -> confirmed -> shipped -> deliveried
 3. customer order both pre order and instock product: same logic as pre order product
As for admin flow in case we need to modify order  (modify only available if order is not confirmed) it will show to customer that their order has a modified status and they will received a notification (implementing later) -> customer confirm the modified -> admin see it is confirmed

~ add wishlist to userpage 

~ clicking on product in cart will take customer to that product page

~ get cart-badge working on every pages and mobile.

i notice if a product is pre order it show in the product page but instock doesnt have instock label, i want each all to have its own label so customer will know.

~ clicking on order from the order history will show full detail of order and what has been modified by admin check show rather customer confirm/reject/contact store (if the order was modify by admin before or after confirming it has to be in the customer awaiting action status, this status is waiting for customer to answer to the modified and also use when awaiting the other half payment sent by admin by making the order status "awaiting final payment" and show pay final bill button to them) 

mobile ui move submit order button to the button instead of the top

~ clicking update address/phone and the motify button should not open the order detial (currently it opened both) i think whatever click on thebig card will always open the detail page.

~ allowing to change order status from the main order page instead of having to click it (keep the original just add more on the main page so i can easily click it) if i set the status to shipped it will pop up a fill in page for me. in that page i have the option for 3 delivered company on top for me to click which one i used 
1. J&T express
2. VET express
3. Jalat express
next is fill in the tracking number and auto fill in the date to the current date for me. setting a picture submitting will be optional.
from the customer page they will get all this info too. oh make sure there is a paste button to paste the tracking number in admin page. and copy button to copy the tracking number in customer page.

~ once product is noted as shipped the buttons should show from the main page not just the detailed page (customer user page).

~ in admin panel, the order detail, i want it to be larger to fill the entire screen (on phone not sure how the current is but on laptop the current layout is too small). make the product clickable and also provide productID , the detail of the order should be enchanced instead of being small but don't make it out of place too much. also both of the notes to customer and admin are all not working properly. 

in the admin product page i want the status to be pre order instead of out of stock for pre order product, however if the product is mark as instock product and we ran out of inventory it suppose to still show out of stock. (pre order does not mean out of stock). for the top 4 display i want to add another card counting pre order product, instock product instead of only having total product. 

small bug when admin anually add order. add product button has a little glitch, check it. 

Both of the note in admin modify order is not working, after filling it and unclick on it it will clear back to blank.

in admin order page, the status box of the order is not styled. give it some css. also i want to make each order a bit larger currently i find it too small. maybe 1.5 times bigger.