// plugins/noShowCancellerCron.ts
import { BookingService } from '../services/booking.service';
import fp from 'fastify-plugin';
import cron from 'node-cron';


export default fp(async function noShowCancellerCron(fastify) {
    let running = false; // in-process guard

    console.log('cron started ')
    const bookingService = new BookingService();
    bookingService.setFastify(fastify)
    b

    const run = async () => {
        if (running) return;
        running = true;
        try {
            // 60-minute buffer after 12:00 check-in
            const res = await bookingService.cancelNoShowBookings(60);
            if (res.cancelled > 0) {
                fastify.log.info({ cancelled: res.cancelled }, 'auto no-show cancel');
            }
        } catch (e) {
            console.log('error in auto no-show cancel failed ', e)
            fastify.log.error(e, 'auto no-show cancel failed');
        } finally {
            running = false;
        }
    };

    // Run at 00:00, 05:00, and 13:00 every day (Asia/Kolkata)
    const task = cron.schedule('0 0 0,5,13,21 * * *', run, { timezone: 'Asia/Kolkata' });

    fastify.addHook('onClose', async () => task.stop());
});
