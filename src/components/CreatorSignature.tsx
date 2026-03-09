import React from 'react';

export const CreatorSignature = () => {
    return (
        <div className="w-full py-3 text-center">
            <p className="font-sans leading-tight text-sm text-inherit opacity-90">
                <b className="font-bold hover:opacity-75 transition-opacity">
                    <a href="https://avpdev.com/en/" className="no-underline text-inherit">Alexios Odos</a>
                </b>
                <span className="mx-2 opacity-30 select-none">|</span>
                <b className="font-bold hover:opacity-75 transition-opacity">
                    <a href="https://avpdev.com/ru/" className="no-underline text-inherit">Aliaksei Patskevich</a>
                </b>
                <br />
                <sub className="block mt-1 opacity-50 tracking-wide text-[11px]">
                    Senior Full-stack Engineer
                    <span className="mx-1 opacity-30">–</span>
                    <a href="https://github.com/AVP-Dev" className="hover:underline decoration-current hover:opacity-100 transition-all">GitHub</a>
                    <span className="mx-1 opacity-30">–</span>
                    <a href="https://t.me/AVP_Dev" className="hover:underline decoration-current hover:opacity-100 transition-all">Telegram</a>
                </sub>
            </p>
        </div>
    );
};
