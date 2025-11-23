export const defaultCurlyBracketPath = "M 33 3 Q 21 4 21 23 Q 16 64 6 66 Q 16 71 21 113 Q 21 131 33 132";


/**
 * draw a curly brace path from (x1,y1) to (x2,y2) with width w and curvature q
 * @param {number} x 
 * @param {number} y 
 * @param {number} x1 
 * @param {number} y1 
 * @param {number} x2 
 * @param {number} y2 
 * @param {number} w 
 * @param {number} q 
 * @returns 
 */
export function makeCurlyBracePath(x,y,x1,y1,x2,y2,w = 50,q = 0.6)
{
        //Calculate unit vector
        var dx = x1-x2;
        var dy = y1-y2;
        var len = Math.sqrt(dx*dx + dy*dy);
        dx = dx / len;
        dy = dy / len;

        //Calculate Control Points of path,
        var qx1 = x1 + q*w*dy;
        var qy1 = y1 - q*w*dx;
        var qx2 = (x1 - .25*len*dx) + (1-q)*w*dy;
        var qy2 = (y1 - .25*len*dy) - (1-q)*w*dx;
        var tx1 = (x1 -  .5*len*dx) + w*dy;
        var ty1 = (y1 -  .5*len*dy) - w*dx;
        var qx3 = x2 + q*w*dy;
        var qy3 = y2 - q*w*dx;
        var qx4 = (x1 - .75*len*dx) + (1-q)*w*dy;
        var qy4 = (y1 - .75*len*dy) - (1-q)*w*dx;

    const path = ( "M " +  x1 + " " +  y1 +
            " Q " + qx1 + " " + qy1 + " " + qx2 + " " + qy2 + 
            " T " + x + " " + y +
            " M " +  x2 + " " +  y2 +
            " Q " + qx3 + " " + qy3 + " " + qx4 + " " + qy4 + 
            " T " + x + " " + y );

    return path;
}