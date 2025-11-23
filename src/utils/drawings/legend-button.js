export function drawButtonLegend(context, isMobile, xPosition, yPosition, textColor, text, addToPositionArray = false) {

        const fontSize = isMobile ? 10 : 16;
        const weight = 700;
        const widthMargin = isMobile ? 30 : 120;
        const textWidth = context.measureText(text).width + widthMargin;
        const borderRadius = 15;

        // create the gradient 
        const gradient = context.createLinearGradient(xPosition, yPosition, xPosition + textWidth, yPosition + 30);
        gradient.addColorStop(0, 'rgba(0, 255, 0, 1)');
        gradient.addColorStop(0.47, 'rgba(0, 255, 0, 0.1)');
        gradient.addColorStop(0.53, 'rgba(255, 0, 0, 0.1)');
        gradient.addColorStop(1, 'rgba(255, 0, 0, 1)');

        // context create button element
        context.fillStyle = gradient; // backgroundColor;
        context.strokeStyle = 'rgb(0, 0, 0, 0)'
        context.beginPath();
        context.moveTo(xPosition + borderRadius, yPosition);
        context.lineTo(xPosition + textWidth - borderRadius, yPosition);
        context.quadraticCurveTo(xPosition + textWidth, yPosition, xPosition + textWidth, yPosition + borderRadius);
        context.lineTo(xPosition + textWidth, yPosition + 30 - borderRadius);
        context.quadraticCurveTo(xPosition + textWidth, yPosition + 30, xPosition + textWidth - borderRadius, yPosition + 30);
        context.lineTo(xPosition + borderRadius, yPosition + 30);
        context.quadraticCurveTo(xPosition, yPosition + 30, xPosition, yPosition + 30 - borderRadius);
        context.lineTo(xPosition, yPosition + borderRadius);
        context.quadraticCurveTo(xPosition, yPosition, xPosition + borderRadius, yPosition);
        context.closePath();
        context.fill();
        context.stroke();

        context.fillStyle = textColor;
        context.font = `${weight} ${fontSize}px system-ui`;
        const textX = xPosition + (textWidth - context.measureText(text).width) / 2;
        const textY = yPosition + 15 + (fontSize / 4);
        context.fillText(text, textX, textY);

        context.stroke();

        // if (addToPositionArray) {
        //     buttonPositions.add({ x: xPosition, y: yPosition, w: textWidth, h: 30 });
        // }

    }