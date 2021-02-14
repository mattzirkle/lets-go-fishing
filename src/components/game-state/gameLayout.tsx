import shuffle from 'lodash/shuffle';
import { useEffect, useState } from 'react';
import DeckLookup from '../other-components/deckLookup'
import { DeckInfoService } from '../../services/deckInfoSvc';
import { DatabaseService, DeckInfo } from '../../services/dbSvc';
import { STARTING_HAND_SIZE, ZONE_BORDER_PX } from '../../utilities/constants';
import { CardActionInfo } from './card';
import { ZoneCardInfo } from './zone';
import { StackZone } from './stackZone';
import { BattlefieldZone } from './battlefieldZone';

export enum ZoneName {
    None = 'none',
    Library = 'library',
    Hand = 'hand',
    Battlefield = 'battlefield',
    Graveyard = 'graveyard',
    Exile = 'exile',
    Command = 'command',
};

export const GameLayout = () => {
    const [libraryCards, setLibraryCards] = useState<ZoneCardInfo[]>([]);
    const [handCards, setHandCards] = useState<ZoneCardInfo[]>([]);
    const [battlefieldCards, setBattlefieldCards] = useState<ZoneCardInfo[]>([]);
    const [graveyardCards, setGraveyardCards] = useState<ZoneCardInfo[]>([]);
    const [exileCards, setExileCards] = useState<ZoneCardInfo[]>([]);
    const [commandCards, setCommandCards] = useState<ZoneCardInfo[]>([]);

    const zoneCards: { [zone: string]: { get: ZoneCardInfo[], set: any } } = {
        [ZoneName.Library]: { get: libraryCards, set: setLibraryCards },
        [ZoneName.Hand]: { get: handCards, set: setHandCards },
        [ZoneName.Battlefield]: { get: battlefieldCards, set: setBattlefieldCards },
        [ZoneName.Graveyard]: { get: graveyardCards, set: setGraveyardCards },
        [ZoneName.Exile]: { get: exileCards, set: setExileCards },
        [ZoneName.Command]: { get: commandCards, set: setCommandCards },
    };
    const getZoneCards = (zone: ZoneName) => zoneCards[zone].get;
    const setZoneCards = (zone: ZoneName, cards: ZoneCardInfo[]) => zoneCards[zone].set(cards);

    const [currentAction, setCurrentAction] = useState<CardActionInfo>();

    const fromLibrary = (action: CardActionInfo) => action.sourceZone === ZoneName.Library;
    const fromBattlefield = (action: CardActionInfo) => action.sourceZone === ZoneName.Battlefield;
    const toBattlefield = (action: CardActionInfo) => action.targetZone === ZoneName.Battlefield;
    const toCommand = (action: CardActionInfo) => action.targetZone === ZoneName.Command;
    const isClick = (action: CardActionInfo) => !action.targetZone;
    const isIntrazoneDrag = (action: CardActionInfo) => action.sourceZone === action.targetZone;
    const isInterzoneDrag = (action: CardActionInfo) => {
        const { sourceZone, targetZone } = action;
        return !!targetZone && targetZone !== sourceZone;
    }

    const startGame = ({ mainboard, commanders }: DeckInfo) => {
        const newLibraryCards = shuffle(mainboard.map(card => ({ card })));
        const { fromArray, toArray } = sliceEndElements(
            newLibraryCards, [], STARTING_HAND_SIZE
        );
        setLibraryCards(fromArray);
        setHandCards(toArray);
        setCommandCards(commanders.map(card => ({ card })));
    };

    const importDeck = async (deckUrl: string) => {
        startGame(await DeckInfoService.getDecklist(deckUrl));
    }

    const draw = (num = 1) => {
        const { fromArray, toArray } = sliceEndElements(libraryCards, handCards, num);
        setLibraryCards(fromArray);
        setHandCards(toArray);
    }

    const sliceEndElements = (fromArray: any[], toArray: any[], num: number) => {
        const cutIndex = fromArray.length - num;
        return {
            fromArray: fromArray.slice(0, cutIndex),
            toArray: toArray.concat(fromArray.slice(cutIndex))
        };
    }

    const sliceCardFromZone = (zoneCard: ZoneCardInfo, zone: ZoneName) => {
        const cards = getZoneCards(zone);
        const index = cards.findIndex(zc => zc.card.id === zoneCard.card.id);
        return [cards.slice(0, index), cards.slice(index + 1)];
    }

    const findZoneCard = (action: CardActionInfo) => {
        return getZoneCards(action.sourceZone).find(zc => zc.card.id === action.card.id)!;
    }

    const getIncrementedZIndex = (zone: ZoneName) => {
        const cards = getZoneCards(zone);
        const highestIndex = cards.some(() => true) ?
            cards.map(zc => zc.zIndex ?? 0).reduce((prev, curr) => Math.max(prev, curr)) : 0;
        return highestIndex + 1;
    }

    const updateCardFromAction = (action: CardActionInfo) => {
        const zoneCard = getZoneCardAfterAction(action);
        updateCard(zoneCard, action);
    }

    const getZoneCardAfterAction = (action: CardActionInfo) => {
        const { card, node } = action;
        if (toBattlefield(action) || (fromBattlefield(action) && isClick(action))) {
            const { x, y } = node!.getBoundingClientRect();
            const zoneCard = findZoneCard(action);
            const tapped = isClick(action) ? !zoneCard.tapped : zoneCard.tapped;
            return { ...zoneCard, x: x - ZONE_BORDER_PX, y: y - ZONE_BORDER_PX, tapped };
        }
        return { card };
    }

    const updateCard = (zoneCard: ZoneCardInfo, action: CardActionInfo) => {
        const { sourceZone, targetZone } = action;
        if (toBattlefield(action)) {
            const zIndex = getIncrementedZIndex(ZoneName.Battlefield);
            zoneCard = { ...zoneCard, zIndex };
        }

        const [sourceSlice1, sourceSlice2] = sliceCardFromZone(zoneCard, sourceZone);
        if (isClick(action) || isIntrazoneDrag(action)) {
            const sourceZoneCards = sourceSlice1.concat(zoneCard).concat(sourceSlice2);
            setZoneCards(sourceZone, sourceZoneCards);
            return;
        }

        const sourceZoneCards = sourceSlice1.concat(sourceSlice2);
        const targetZoneCards = getZoneCards(targetZone!).concat(zoneCard);
        setZoneCards(sourceZone, sourceZoneCards);
        setZoneCards(targetZone!, targetZoneCards);
    }

    const onCardDrag = (action: CardActionInfo) => {
        if (!currentAction) setCurrentAction(action);
        return true;
    };

    const onCardDragStop = (action: CardActionInfo) => {
        try {
            action = currentAction ?? action;

            if (action.targetZone === ZoneName.None) return false;

            if (isClick(action)) {
                if (fromLibrary(action)) {
                    draw();
                    return true;
                }
                else if (fromBattlefield(action)) {
                    updateCardFromAction(action);
                }
                return false;
            }

            const interzoneDrag = isInterzoneDrag(action);
            if (interzoneDrag || (isIntrazoneDrag(action) && fromBattlefield(action))) {
                // Only allow commanders to be moved to the command zone.
                if (toCommand(action) && !action.card.commander) return false;
                updateCardFromAction(action);
            }
            return interzoneDrag;
        }
        finally { setCurrentAction(undefined); }
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!currentAction) return;
        const mouseOverElems = document.elementsFromPoint(e.clientX, e.clientY);
        const targetElem = mouseOverElems.find(elem => elem.classList.contains('zone'));
        setCurrentAction({
            ...currentAction,
            targetZone: (targetElem ? targetElem.id as ZoneName : ZoneName.None)
        });
    }

    useEffect(() => {
        (async () => {
            const decklist = await DatabaseService.getDeck();
            if (decklist) startGame(decklist);
        })();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const zoneProps = { action: currentAction, onCardDrag, onCardDragStop };
    return (
        <>
            <div className="toolbar">
                <DeckLookup onImportClick={importDeck} />
            </div>
            <div className="gameLayout" onMouseMove={onMouseMove}>
                <div className="topPanel">
                    <div className="gutter"></div>
                    <BattlefieldZone
                        {...zoneProps}
                        name={ZoneName.Battlefield}
                        contents={battlefieldCards}
                    />
                    <StackZone
                        {...zoneProps}
                        name={ZoneName.Graveyard}
                        contents={graveyardCards}
                        enablePreview={true}
                        vertical={true}
                    />
                </div>
                <div className="bottomPanel">
                    <StackZone
                        {...zoneProps}
                        name={ZoneName.Command}
                        contents={commandCards}
                        showTopOnly={true}
                    />
                    <StackZone
                        {...zoneProps}
                        name={ZoneName.Hand}
                        contents={handCards}
                        enablePreview={true}
                    />
                    <StackZone
                        {...zoneProps}
                        name={ZoneName.Library}
                        contents={libraryCards}
                        faceDown={true}
                        showTopOnly={true}
                    />
                    <StackZone
                        {...zoneProps}
                        name={ZoneName.Exile}
                        contents={exileCards}
                        showTopOnly={true}
                    />
                </div>
            </div>
        </>
    );
};
